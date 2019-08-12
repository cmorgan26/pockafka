const Kafka = require("node-rdkafka");
const bunyan = require("bunyan");
const config = require("config.js")
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

let messages_delivered = 0
let messages_sent = 0
let producer_ready = false
let producer_config = {};
producer_config = {
  ...config.rdkafka.base_config,
  ...config.rdkafka.producer_config
};
const producer = new Kafka.Producer(producer_config);
producer.on("delivery-report", function(err, report) {
  log.info("delivery report incoming");
  messages_delivered++
  log.info(report);
  log.info(`Messages delivered: ${messages_delivered}`)
})
producer.on("event.error", function(e) {
  log.error(e);
})
producer.setPollInterval(100);
producer.connect(null, function() {
  producer_ready = true
})
log.info(producer)
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
for (let i=0; i < 10; i++){
  messages_sent++
  log.info(`Messages sent = ${messages_sent}`)
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