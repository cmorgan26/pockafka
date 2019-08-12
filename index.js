const Kafka = require("node-rdkafka");
const bunyan = require("bunyan");
const log = bunyan.createLogger({
  name: process.env.APP_NAME || "useriq_bigdata_stream",
  level: process.env.LOGGING_LEVEL || "info",
  stream: process.stdout
  /*streams: [
    {
      level: process.env.LOGGING_LEVEL || "info",
      path: path.join(__dirname,"..","logs","wiki.log")
    }
  ]*/
});

log.info(Kafka.features);
log.info(Kafka.librdkafkaVersion);

let message_sent = 0
let message_received = 0
let producer_ready = false
let producer_config = {};
producer_config = {
    'bootstrap.servers': process.env.CONFLUENT_URL || 'localhost:9092',
    'api.version.request': true,
    'broker.version.fallback': '0.10.0.0',
    'api.version.fallback.ms': 0,
    'sasl.mechanisms': 'PLAIN',
    'security.protocol': 'SASL_SSL',
    'ssl.ca.location': '/usr/local/etc/openssl/cert.pem',
    'sasl.username': process.env.CONFLUENT_API_KEY,
    'sasl.password': process.env.CONFLUENT_SECRET_KEY,
    'client.id': (() => {
      const dyno = process.env.DYNO
      const isChild = process.send !== undefined
      const r = Math.floor(Math.random()*1e4)
      let suffix = r
      if (dyno) {
        suffix = dyno
        if (isChild)
          suffix = `${suffix}_${process.pid}`
      }
      return `useriq_bigdata_stream_node_${suffix}`
    })()
  ,
      'compression.codec': 'gzip',
      'retry.backoff.ms': 200,
      'message.send.max.retries': 10,
      'socket.keepalive.enable': true,
      'queue.buffering.max.messages': 100000,
      'queue.buffering.max.ms': 1000,
      'batch.num.messages': 1000000,
      'dr_cb': true
  
}
const producer = new Kafka.Producer(producer_config);
producer.on("delivery-report", function(err, report) {
  log.info("delivery report incoming");
  message_sent++
  log.info(report);
  log.info(`Messages sent: ${message_sent}`)
})
producer.on("event.error", function(e) {
  log.error(e);
})
producer.setPollInterval(100);
producer.connect(null, function() {
  producer_ready = true
})

async function sleep(timeoutMs=1000) {
  return await new Promise(resolve => setTimeout(resolve, timeoutMs))
}

async function sendMessage(topic, message) {
  if(producer_ready){
    // topic, partition (-1 tells it to use internal schema), message
    try {
      await producer.produce(topic, -1, message)
    } catch (err) {
      log.error('A problem occurred when sending our message');
      log.error(err);
    }
  } else {
    await sleep(250).catch(err => log.error(err))
    return await sendMessage(topic, message)
  }
}
for (let i=0; i < 1000; i++){
  message_received++
  log.info(`Messages received = ${message_received}`)
  sendMessage('events_raw_qa', 'Hello Confluent').catch(err => log.error(err))
}
process.on("SIGINT", killProcess);
process.on("SIGTERM", killProcess);

function killProcess() {
  producer.disconnect(null, function(){
    producer_ready = false
  })
  setTimeout(() => process.exit(), 8000);
}