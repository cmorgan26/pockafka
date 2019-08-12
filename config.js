import bsyslog from 'bunyan-syslog-udp'

var self = module.exports = {
  app: {
    name: process.env.APP_NAME || "useriq_bigdata_stream"
  },

  server: {
    PORT: process.env.PORT || 8000,
    CLUSTER_MAX_CPUS: process.env.CLUSTER_MAX_CPUS || process.env.WEB_CONCURRENCY || 1,
    IS_PRODUCTION: process.env.IS_PRODUCTION || (process.env.NODE_ENV === 'production') || false,
    HOST: process.env.HOSTNAME || "http://localhost:8080"
  },

  socketio: {},

  heroku: {
    name: process.env.APP_NAME || "useriq_bigdata_stream",
    internal_name: process.env.HEROKU_APP_NAME || "useriq-bigdata-stream",
    api_key: process.env.HEROKU_API_KEY,
    concurrency: process.env.WEB_CONCURRENCY || 3,
    validator_concurrency: process.env.VALIDATOR_CONCURRENCY || 1
  },

  slack: {
    webhookUrl: process.env.SLACK_WEBHOOK_URL
  },

  archive: {
    bucket: process.env.AWS_S3_ARCHIVE_BUCKET || 'events.useriq.com',
    localFilepath: process.env.ARCHIVE_FILEPATH || '/tmp',
    messageMax: parseInt(process.env.ARCHIVE_MESSAGE_MAX || 1e5)
  },

  aws: {
    access_key: process.env.AWS_ACCESS_KEY_ID,
    access_secret: process.env.AWS_SECRET_ACCESS_KEY,

    s3: {
      bucket: process.env.AWS_S3_BUCKET || 'export.useriq.com'
    },

    emr: {
      child_instance_size: process.env.AWS_EMR_CHILD_INSTANCE_TYPE,
      child_instance_count: process.env.AWS_EMR_CHILD_INSTANCE_COUNT
    }
  },

  redis: {
    sentinel: {
      master: process.env.REDIS_SENTINEL_MASTER,
      ips: process.env.REDIS_SENTINEL_IPS,
    },
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    cache_all: process.env.REDIS_CACHE_ALL
  },

  resque: {
    default_queue: process.env.RESQUE_QUEUE || 'useriq_resque_default'
  },

  cassandra: {
    host: process.env.CASSANDRA_HOST || 'localhost',
    port: process.env.CASSANDRA_PORT || 9042,
    keyspace: process.env.CASSANDRA_KEYSPACE || 'useriq',
    user: process.env.CASSANDRA_USER,
    password: process.env.CASSANDRA_PASSWORD,
    ssl: {
      server_cert: process.env.CASSANDRA_SERVER_CERT,
      cert: process.env.CASSANDRA_CLIENT_CERT,
      key: process.env.CASSANDRA_CLIENT_KEY
    },

    connections_per_host: parseInt(process.env.CASSANDRA_CONNECTIONS_PER_HOST || 10),
    max_queries_in_batch: parseInt(process.env.CASSANDRA_MAX_BATCH || 200)
  },
  rdkafka: {
    base_config: {
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
    },
    producer_config: {
      'compression.codec': 'gzip',
      'retry.backoff.ms': 200,
      'message.send.max.retries': 10,
      'socket.keepalive.enable': true,
      'queue.buffering.max.messages': 100000,
      'queue.buffering.max.ms': 1000,
      'batch.num.messages': 1000000,
      'dr_cb': true
    },
    consumer_config: {
      'group.id': null,
      'fetch.message.max.bytes': null,
      'session.timeout.ms': null,
      'enable.auto.commit': false
    },
    consume_interval: 100,
    maxParallelHandles: process.env.CONFLUENT_MAX_HANDLES || 1000,
    maxQueueSize: process.env.CONFLUENT_MAX_QUEUE || 50000,
    validatorGroupId: 'events_raw_validator'
  },
  kafka: {
    connection_string: process.env.KAFKA_URL || 'localhost:9092',
    target_transfer_connection_string: process.env.TARGET_KAFKA_URL || 'localhost:9092',
    cert: process.env.KAFKA_CLIENT_CERT,
    key: process.env.KAFKA_CLIENT_CERT_KEY,
    client_id: (() => {
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
    })(),
    topics: {
      prefix: process.env.KAFKA_TOPIC_PREFIX,
      suffix: process.env.KAFKA_TOPIC_SUFFIX,

      events_raw: {
        name: 'events_raw',
        partitions: parseInt(process.env.KAFKA_EVENTS_RAW_PARTITIONS || 1)
      },
      events_segment: {
        name: 'events_segment',
        partitions: parseInt(process.env.KAFKA_EVENTS_SEGMENT_PARTITIONS || 1)
      },
      events_segment_valid: {
        name: 'events_segment_valid',
        partitions: parseInt(process.env.KAFKA_EVENTS_SEGMENT_VALID_PARTITIONS || 1)
      },
      events_segment_invalid: {
        name: 'events_segment_invalid',
        partitions: parseInt(process.env.KAFKA_EVENTS_SEGMENT_INVALID_PARTITIONS || 1)
      },
      events_valid: {
        name: 'events_valid',
        partitions: parseInt(process.env.KAFKA_EVENTS_VALID_PARTITIONS || 1)
      },
      events_invalid: {
        name: 'events_invalid',
        partitions: parseInt(process.env.KAFKA_EVENTS_INVALID_PARTITIONS || 1)
      },
      track_campaign_valid: {
        name: 'track_campaign_valid',
        partitions: parseInt(process.env.KAFKA_TRACK_CAMPAIGN_VALID_PARTITIONS || 1)
      },
      track_campaign_invalid: {
        name: 'track_campaign_invalid',
        partitions: parseInt(process.env.KAFKA_TRACK_CAMPAIGN_INVALID_PARTITIONS || 1)
      },
      save_campaign_valid: {
        name: 'save_campaign_valid',
        partitions: parseInt(process.env.KAFKA_SAVE_CAMPAIGN_VALID_PARTITIONS || 1)
      },
      save_campaign_invalid: {
        name: 'save_campaign_invalid',
        partitions: parseInt(process.env.KAFKA_SAVE_CAMPAIGN_INVALID_PARTITIONS || 1)
      }
    },

    // enrichment_commit_latest: !!process.env.COMMIT_LATEST_OFFSET_ENRICHMENT
  },

  postgres: {
    connection_string: process.env.DATABASE_URL || 'postgres://localhost:5432',
    readonly_connection_string: process.env.ANALYTICS_DATABASE_URL || process.env.DATABASE_URL || 'postgres://localhost:5432',
    maxClientsLarge: parseInt(process.env.POSTGRES_LARGE_MAX_CLIENTS || 10),
    maxClientsSmall: parseInt(process.env.POSTGRES_SMALL_MAX_CLIENTS || 2)
  },

  elasticsearch: {
    host: process.env.ELASTICSEARCH_HOST
  },

  useriq: {
    main_app_host: process.env.USERIQ_APP_HOST || 'http://dev.useriq.com:3000',
    deviseSecretKey: process.env.DEVISE_SECRET_KEY,
    deviseCookieName: (() => (process.env.NODE_ENV === 'production') ? '_uiq_app_session_v4' : '_uiq_dev_session_v4' )()
  },

  cryptography: {
    algorithm: "aes-256-ctr",
    password: process.env.CRYPT_SECRET
  },

  logger: {
    options: {
      name: process.env.APP_NAME || "useriq_bigdata_stream",
      level: process.env.LOGGING_LEVEL || "info",
      stream: process.stdout
      /*streams: [
        {
          level: process.env.LOGGING_LEVEL || "info",
          path: path.join(__dirname,"..","logs","wiki.log")
        }
      ]*/
    },

    papertrail_options: {
      name: process.env.APP_NAME || "useriq_bigdata_stream",
      streams: [
        {
          level: process.env.LOGGING_LEVEL || "info",
          type: "raw",
          stream: bsyslog.createBunyanStream({
            name: process.env.APP_NAME || "useriq_bigdata_stream",
            host: process.env.PAPERTRAIL_HOST,
            port: parseInt(process.env.PAPERTRAIL_PORT) || 514,
            facility: 'local0'
          })
        },
        {
          level: process.env.LOGGING_LEVEL || "info",
          stream: process.stdout
        }
      ]
    }
  }
}
