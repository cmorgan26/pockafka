import child_process from 'child_process'
import url from 'url'

export {
  datePieceTwoChars,
  exponentialBackoff,
  extCvarDataFallback,
  flattenArray,
  forkPromise,
  getCacheToDatabaseFallback,
  getNewFileName,
  getTimeMinutesAgo,
  ignoreProtocol,
  indicesOf,
  makePathLowerCase,
  matchWildcard,
  matchScreens,
  mergeObject,
  getObjectValueSafely,
  paginateArray,
  parseMoneyToFloat,
  parseToRegex,
  shouldFallbackToExternalData,
  sleep,
  sleepAndReduceTimeBasedOnInitialValue
}

const fork = child_process.fork
const NOOP = () => {}

export const specialEventColumns = ['user_id', 'user_name', 'user_type', 'account_id', 'account_name', 'user_email', 'signup_date']
export const tabooCvarList = [
  "useriq-unknown",
  "insert_user_id",
  "insert_user_name",
  "user_name",
  "account_id",
  "account_name",
  "guest",
  "not logged in",
  "insert_account_id",
  "insert_account_name",
  "anonymous",
  "null",
  "user_id",
  "nil",
  "none",
  "empty",
  "visitor",
  "unknown"
]

async function sleep(timeoutMs=1000) {
  return await new Promise(resolve => setTimeout(resolve, timeoutMs))
}

async function sleepAndReduceTimeBasedOnInitialValue(initialTimeMs, numIterations=10, iteration=1) {
  if (initialTimeMs === 0 || iteration >= numIterations)
    return

  const linearReduction = Math.floor(iteration * (initialTimeMs / numIterations))
  return await sleep(initialTimeMs - linearReduction)
}

async function forkPromise(scriptName, paramsAry=[]) {
  return await new Promise((resolve, reject) => {
    const child = fork(scriptName, paramsAry)
    child.on('error',      err => reject(err))
    child.on('disconnect', info => resolve(info))
  })
}

function getNewFileName(fileName, extraText=Date.now()) {
  const lastPeriod = fileName.lastIndexOf(".")
  return `${fileName.substring(0,lastPeriod)}_${extraText}${fileName.substring(lastPeriod)}`
}

function mergeObject(obj1, obj2, obj3) {
  obj3 = obj3 || {}
  const isObject = function(obj,attr) {
    const toClass = {}.toString
    return typeof obj[attr] === "object" && toClass.call(obj[attr]) == "[object Object]"
  }

  if (typeof obj1 !== 'object') {
    //do nothing
  } else if (typeof obj2 !== 'object') {
    for (const attrname in obj1) {
      if (isObject(obj1,attrname)) obj3[attrname] = mergeObject(obj1[attrname], null, obj3[attrname])
      else obj3[attrname] = obj1[attrname]
    }
  } else {
    for (const attrname in obj1) {
      if (isObject(obj1,attrname)) obj3[attrname] = mergeObject(obj1[attrname], null, obj3[attrname])
      else obj3[attrname] = obj1[attrname]
    }
    for (const attrname in obj2) {
      if (isObject(obj2,attrname)) obj3[attrname] = mergeObject(obj2[attrname], null, obj3[attrname])
      else obj3[attrname] = obj2[attrname]
    }
  }
  return obj3
}

function shouldFallbackToExternalData(siteRecord) {
  return !!siteRecord.ext_cvars_fallback
}

async function extCvarDataFallback(parsedMessage, postgres) {
  const remainingSpecialEventColumns = specialEventColumns.filter(c => !parsedMessage[c])
  if (remainingSpecialEventColumns.length) {
    const customerUserId = parsedMessage.customer_user_id || parsedMessage.user_id
    if (customerUserId) {
      const results = await postgres.query(`
        select * from ext_data
        where
          site_id = $1 and
          customer_user_id = $2 and
          uiq_table = 'visitors' and
          uiq_column = ANY($3)
      `, [ parsedMessage.site_id, customerUserId, remainingSpecialEventColumns ])

      if (results && results.rows.length > 0) {
        results.rows.forEach(d => {
          parsedMessage[d.uiq_column] = d.ext_value
          parsedMessage[`customer_${d.uiq_column}`] = d.ext_value
        })
      }
    }
  }
  return parsedMessage
}

function matchWildcard(wildcardedUrl, plainUrl, shouldIgnoreProtocol=true, queryStringCaseInsensitive=false) {
  if (shouldIgnoreProtocol) {
    wildcardedUrl = ignoreProtocol(wildcardedUrl || '')
    plainUrl = ignoreProtocol(plainUrl || '')
  }

  // We want the host and path in the URL to be case insensitive
  wildcardedUrl = makePathLowerCase(wildcardedUrl || '')
  plainUrl = makePathLowerCase(plainUrl || '')

  if (queryStringCaseInsensitive) {
    const parsedWildcardedUrl = url.parse(wildcardedUrl)
    const parsedPlainUrl = url.parse(plainUrl)

    wildcardedUrl = (parsedWildcardedUrl.query) ? wildcardedUrl.replace(parsedWildcardedUrl.query, parsedWildcardedUrl.query.toLowerCase()) : wildcardedUrl
    plainUrl = (parsedPlainUrl.query) ? plainUrl.replace(parsedPlainUrl.query, parsedPlainUrl.query.toLowerCase()) : plainUrl
  }

  const regexToCheck = parseToRegex(wildcardedUrl)
  return regexToCheck.test(plainUrl)
}

function matchScreens(triggerValue, originScreen) {
  if (originScreen === triggerValue || triggerValue === NULL) {
    return true
  }
  return false
}

function makePathLowerCase(schema) {
  const delimiter = ' | '
  const pieces = schema.split(delimiter)
  const urlPart = pieces[pieces.length - 1]
  const parsedUrlPart = url.parse(urlPart)
  const loweredUrlPart = (parsedUrlPart.pathname) ? urlPart.replace(parsedUrlPart.pathname, parsedUrlPart.pathname.toLowerCase()) : ''
  return `${(pieces.length > 1) ? pieces.slice(0, pieces.length - 1).join(delimiter) + ' | ' : ''}${loweredUrlPart}`
}

function paginateArray(ary, perPage = 9e7, pageNumber = 1) {
  const start = perPage * (pageNumber - 1)

  if (ary instanceof Array) {
    const size = ary.length
    return {
      data: ary.slice(start, start + perPage),
      number_of_pages: Math.ceil(size / perPage),
      current_page: pageNumber,
      data_length: size
    }
  } else if (typeof ary === "object" && ary != null) {
    const obj = ary
    const keys = Object.keys(obj).sort()
    const size = keys.length
    const filteredKeys = keys.slice(start,start+perPage)
    let filteredObj = {}
    for (var _i=0; _i<filteredKeys.length; _i++) {
      filteredObj[filteredKeys[_i]] = obj[filteredKeys[_i]];
    }

    return {
      data: filteredObj,
      number_of_pages: Math.ceil(size/perPage),
      current_page: pageNumber,
      data_length: size
    }
  }

  return ary
}

function getTimeMinutesAgo(numMinutes=30, intUnit='seconds', epochSecondsToCompare=Date.now()) {
  const milliSeconds = epochSecondsToCompare - (1000*60*numMinutes)

  switch (intUnit) {
    case 'milliseconds':
      return milliSeconds
    case 'seconds':
      return Math.floor(milliSeconds / 1000)
    case 'minutes':
      return Math.floor(milliSeconds / 1000 / 60)
    case 'hours':
      return Math.floor(milliSeconds / 1000 / 60 / 60)
    default:
      return getTimeMinutesAgo(numMinutes, 'seconds')
  }
}

function ignoreProtocol(string) {
  return string.replace(/^(http|https)?:\/\//, '')
}

function parseToRegex(regexString) {
  const escaped = regexString.replace(/[^A-Za-z0-9]/g, (match, p1, p2, p3, offset, string) => `\\${match}`)
  const wildcardReplaced = escaped.replace(/\\\*/g, '[\\s\\S]*?')
  return new RegExp(`^${wildcardReplaced}$`)
}

function datePieceTwoChars(datePiece){
  return (datePiece.toString().length === 1) ? `0${datePiece}` : datePiece.toString()
}

function parseMoneyToFloat(input) {
  return parseFloat(input.toString().replace(/[^\d\.]/g, ''))
}

function indicesOf(substring, string) {
  let a = []
  let i = -1
  while ((i = string.indexOf(substring,i+1)) >= 0)
    a.push(i)

  return a
}

function flattenArray(ary) {
  const nestedFlattened = ary.map(v => {
    if (v instanceof Array)
      return flattenArray(v)
    return v
  })
  return [].concat.apply([], nestedFlattened)
}

// Path should be a string with dot-notation describing the value of nested
// objects directing us to the key's value we want to get.
// `fallback` will be used in any situation that the value received by the
// retrieval is falsy AND the fallback is not null.
//
// Examples:
//  For obj == { key1: { key2: 'val2' } }
//    'key1': { key2: 'val2' } would be returned
//    'key1.key2': 'val2' would be returned
function getObjectValueSafely(obj, path, fallback=null) {
  try {
    const val = path.split('.').reduce((nestedObj, key) => (nestedObj && nestedObj[key] !== undefined) ? nestedObj[key] : undefined, obj)

    if (val !== undefined)
      return val

    return (fallback != null) ? (val || fallback) : val
  } catch(err) {
    return fallback
  }
}

async function exponentialBackoff(promiseFunction, failureFunction=NOOP, err=null, totalAllowedBackoffTries=3, backoffAttempt=1) {
  const backoffSecondsToWait = 2 + Math.pow(backoffAttempt, 2)

  if (backoffAttempt > totalAllowedBackoffTries)
    throw err

  try {
    const result = await promiseFunction()
    return result
  } catch(err) {
    failureFunction(err, backoffAttempt)
    await sleep(backoffSecondsToWait * 1000)
    return await exponentialBackoff(promiseFunction, failureFunction, err, totalAllowedBackoffTries, backoffAttempt + 1)
  }
}

async function getCacheToDatabaseFallback({ cache, postgres, cassandra }, cacheKey, query, values=[], dbType='postgres') {
  const cachedResults = await cache.get(cacheKey)
  if (cachedResults)
    return JSON.parse(cachedResults)

  let results = null
  switch (dbType) {
    case 'cassandra':
      results = await cassandra.query(query, values)
      break
    default: // 'postgres'
      results = await postgres.query(query, values)
  }

  if (results && results.rows && results.rows.length > 0)
    await cache.set(cacheKey, JSON.stringify(results.rows))

  return results.rows
}
