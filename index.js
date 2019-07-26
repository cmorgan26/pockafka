var Kafka = require('node-rdkafka');
console.log(Kafka.features);
console.log(Kafka.librdkafkaVersion);
// Our producer with its Kafka brokers
// This call returns a new writable stream to our topic 'topic-name'
var stream = Kafka.Producer.createWriteStream({
  'metadata.broker.list': 'localhost:9092'
}, {}, {
    topic: 'topic-uiq-test-kafka'
  });

// Writes a message to the stream
var queuedSuccess = stream.write(Buffer.from('Awesome message'));

if (queuedSuccess) {
  console.log('We queued our message!');
} else {
  // Note that this only tells us if the stream's queue is full,
  // it does NOT tell us if the message got to Kafka!  See below...
  console.log('Too many messages in our queue already');
}

// NOTE: MAKE SURE TO LISTEN TO THIS IF YOU WANT THE STREAM TO BE DURABLE
// Otherwise, any error will bubble up as an uncaught exception.
stream.on('error', function (err) {
  // Here's where we'll know if something went wrong sending to Kafka
  console.error('Error in our kafka stream');
  console.error(err);
})