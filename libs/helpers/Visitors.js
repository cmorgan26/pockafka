import HtmlEntities from 'html-entities'
import { specialEventColumns, tabooCvarList } from '../Helpers'

export {
  getVisitorsInSite,
  isInternalVisitor,
  isUknownVisitorAndShouldIgnore,
  getUserFeedRedisKeyScoreObject,
  getUsersOnlineRedisKeyScoreObject,
  getVisitorUpsertQuery,
  mergeTwoSetsOfRawCvars,
  parseCvars,
  reverseParseCvars,
  saveVisitorRecord,
  shouldIgnoreUsersSettings
}

async function getVisitorsInSite(postgres, siteId, page=1, pageSize=1000) {
  const { rows } = await postgres.query(`
    select * from visitors
    where idsite = $1 and is_internal is not true
    order by id
    limit $2
    offset $3
  `, [ siteId, pageSize, (page-1)*pageSize ])
  return rows
}

function isInternalVisitor(siteRecord, parsedEvent, visitorRecord=null) {
  if (visitorRecord && visitorRecord.is_internal_override)
    return visitorRecord.is_internal

  if (typeof siteRecord === 'object') {
    const internalDomains = siteRecord.internal_domains
    const userEmail = parsedEvent.customer_user_email
    if (internalDomains && userEmail) {
      const splitEmail = userEmail.split('@')
      if (splitEmail[1]) {
        const emailDomain = splitEmail[1].toLowerCase()
        const splitDomains = internalDomains.split(',').map(d => (d) ? d.toLowerCase().trim() : d)
        if (splitDomains.indexOf(emailDomain) > -1)
          return true
      }
    }
  }
  return false
}

function isUknownVisitorAndShouldIgnore(siteRecord, parsedEvent) {
  return siteRecord && siteRecord.ignore_unknown_visitors && !parsedEvent.customer_user_id
}

function getUserFeedRedisKeyScoreObject(parsedEvent, segmentId=null) {
  const siteId = parsedEvent.site_id

  let key = `user_feed_${siteId}`
  if (segmentId)
    key += `_${segmentId}`

  const visitorId = parsedEvent.visitor_id
  const customerUserId = parsedEvent.customer_user_id || `uiqvid:${visitorId}`
  const customerUserName = parsedEvent.customer_user_name
  const createdAtTimestamp = parseInt(parsedEvent.created_at_timestamp / 1000)

  const dataToStore = {
    customer_user_id: customerUserId,
    display_name: customerUserName || customerUserId || parsedEvent.customer_user_email,
    is_internal: isInternalVisitor(parsedEvent._site, parsedEvent)
  }

  return [key, createdAtTimestamp, dataToStore]
}

function getUsersOnlineRedisKeyScoreObject(parsedEvent, segmentId=null) {
  const site_id             = parsedEvent.site_id
  const visitorId           = parsedEvent.visitor_id
  const customerUserId      = parsedEvent.customer_user_id || `uiqvid:${visitorId}`
  const customerUserName    = parsedEvent.customer_user_name
  const customerAccountId   = parsedEvent.customer_account_id
  const customerAccountName = (parsedEvent._customer_account) ? (parsedEvent._customer_account.customer_account_name || parsedEvent.customer_account_name) : parsedEvent.customer_account_name
  const isInternal          = isInternalVisitor(parsedEvent._site, parsedEvent, parsedEvent._visitor)
  // passed as milliseconds, but convert to seconds epoch
  const score = parseInt(parsedEvent.created_at_timestamp / 1000)

  let key = `users_online_by_site_${site_id}`
  if (segmentId)
    key += `_${segmentId}`

  const valToAdd = {
    id: null,
    site_id: site_id,
    customer_user_id: customerUserId,
    visitor_name: customerUserName,
    visitor_email: parsedEvent.customer_user_email,
    customer_account_id: customerAccountId,
    customer_account_name: customerAccountName,
    is_internal: isInternal
  }

  return [key, score, valToAdd]
}

function getVisitorUpsertQuery(visitor, userIdCache=null) {
  return {
    upsertQuery: `
    ${insertQuery().replace(/\n|\s\s/g, " ")}
    ON CONFLICT ON CONSTRAINT visitors_idsite_customer_user_id_key
    DO ${updateQuery('user_id').replace(/(\w+)(.*)(\$\d+)(,*)/g, '$1 = EXCLUDED.$1$4').replace(/\n|\s\s/g, " ").replace("update visitors set", "update set").replace("idsite", "visitors.idsite").replace("CUSTOMER_USER_ID = EXCLUDED.CUSTOMER_USER_ID", "visitors.customer_user_id = EXCLUDED.customer_user_id")}`,
    upsertParams: [
      visitor.visitor_id,
      visitor.visitor_fname,
      visitor.visitor_lname,
      visitor.visitor_name,
      visitor.visitor_email,
      visitor.first_visit,
      visitor.last_visit,
      visitor.visitor_photo_url,
      visitor.first_visit,
      visitor.last_visit,
      visitor.customer_signup_date,
      visitor.customer_account_id,
      visitor.customer_user_id || userIdCache,
      visitor.customer_account_name,
      visitor.is_internal,
      visitor.is_internal_override,
      visitor.customer_signup_date,
      visitor.cvar1_name,
      visitor.cvar1_value,
      visitor.cvar2_name,
      visitor.cvar2_value,
      visitor.cvar3_name,
      visitor.cvar3_value,
      visitor.cvar4_name,
      visitor.cvar4_value,
      visitor.cvar5_name,
      visitor.cvar5_value,
      visitor.cvar6_name,
      visitor.cvar6_value,
      visitor.cvar7_name,
      visitor.cvar7_value,
      visitor.cvar8_name,
      visitor.cvar8_value,
      visitor.cvar9_name,
      visitor.cvar9_value,
      visitor.cvar10_name,
      visitor.cvar10_value,
      visitor.cvar11_name,
      visitor.cvar11_value,
      visitor.cvar12_name,
      visitor.cvar12_value,
      visitor.cvar13_name,
      visitor.cvar13_value,
      visitor.cvar14_name,
      visitor.cvar14_value,
      visitor.cvar15_name,
      visitor.cvar15_value,
      visitor.cvar16_name,
      visitor.cvar16_value,
      visitor.cvar17_name,
      visitor.cvar17_value,
      visitor.cvar18_name,
      visitor.cvar18_value,
      visitor.cvar19_name,
      visitor.cvar19_value,
      visitor.cvar20_name,
      visitor.cvar20_value,
      visitor.last_browser_name,
      visitor.last_browser_version,
      visitor.last_os_name,
      visitor.custom_variables,
      visitor.created_at || new Date(),
      new Date(),
      visitor.site_id || visitor.idsite
    ]
  }
}

async function saveVisitorRecord(postgres, visitor, visitorIsNew=false) {
  if (visitorIsNew) {
    await postgres.query(insertQuery(), [
      visitor.visitor_id,
      visitor.visitor_fname,
      visitor.visitor_lname,
      visitor.visitor_name,
      visitor.visitor_email,
      visitor.first_visit,
      visitor.last_visit,
      visitor.visitor_photo_url,
      visitor.first_visit,
      visitor.last_visit,
      visitor.customer_signup_date,
      visitor.customer_account_id,
      visitor.customer_user_id,
      visitor.customer_account_name,
      visitor.is_internal,
      visitor.is_internal_override,
      visitor.customer_signup_date,
      visitor.cvar1_name,
      visitor.cvar1_value,
      visitor.cvar2_name,
      visitor.cvar2_value,
      visitor.cvar3_name,
      visitor.cvar3_value,
      visitor.cvar4_name,
      visitor.cvar4_value,
      visitor.cvar5_name,
      visitor.cvar5_value,
      visitor.cvar6_name,
      visitor.cvar6_value,
      visitor.cvar7_name,
      visitor.cvar7_value,
      visitor.cvar8_name,
      visitor.cvar8_value,
      visitor.cvar9_name,
      visitor.cvar9_value,
      visitor.cvar10_name,
      visitor.cvar10_value,
      visitor.cvar11_name,
      visitor.cvar11_value,
      visitor.cvar12_name,
      visitor.cvar12_value,
      visitor.cvar13_name,
      visitor.cvar13_value,
      visitor.cvar14_name,
      visitor.cvar14_value,
      visitor.cvar15_name,
      visitor.cvar15_value,
      visitor.cvar16_name,
      visitor.cvar16_value,
      visitor.cvar17_name,
      visitor.cvar17_value,
      visitor.cvar18_name,
      visitor.cvar18_value,
      visitor.cvar19_name,
      visitor.cvar19_value,
      visitor.cvar20_name,
      visitor.cvar20_value,
      visitor.last_browser_name,
      visitor.last_browser_version,
      visitor.last_os_name,
      visitor.custom_variables,
      new Date(),
      new Date(),
      visitor.site_id || visitor.idsite,
    ])
    return true

  } else {
    const visitorPrimaryKey = visitor.id
    await postgres.query(updateQuery(), [
      visitor.visitor_id,
      visitor.visitor_fname,
      visitor.visitor_lname,
      visitor.visitor_name,
      visitor.visitor_email,
      visitor.first_visit,
      visitor.last_visit,
      visitor.visitor_photo_url,
      visitor.first_visit,
      visitor.last_visit,
      visitor.customer_signup_date,
      visitor.customer_account_id,
      visitor.customer_user_id,
      visitor.customer_account_name,
      visitor.is_internal,
      visitor.is_internal_override,
      visitor.customer_signup_date,
      visitor.cvar1_name,
      visitor.cvar1_value,
      visitor.cvar2_name,
      visitor.cvar2_value,
      visitor.cvar3_name,
      visitor.cvar3_value,
      visitor.cvar4_name,
      visitor.cvar4_value,
      visitor.cvar5_name,
      visitor.cvar5_value,
      visitor.cvar6_name,
      visitor.cvar6_value,
      visitor.cvar7_name,
      visitor.cvar7_value,
      visitor.cvar8_name,
      visitor.cvar8_value,
      visitor.cvar9_name,
      visitor.cvar9_value,
      visitor.cvar10_name,
      visitor.cvar10_value,
      visitor.cvar11_name,
      visitor.cvar11_value,
      visitor.cvar12_name,
      visitor.cvar12_value,
      visitor.cvar13_name,
      visitor.cvar13_value,
      visitor.cvar14_name,
      visitor.cvar14_value,
      visitor.cvar15_name,
      visitor.cvar15_value,
      visitor.cvar16_name,
      visitor.cvar16_value,
      visitor.cvar17_name,
      visitor.cvar17_value,
      visitor.cvar18_name,
      visitor.cvar18_value,
      visitor.cvar19_name,
      visitor.cvar19_value,
      visitor.cvar20_name,
      visitor.cvar20_value,
      visitor.last_browser_name,
      visitor.last_browser_version,
      visitor.last_os_name,
      visitor.custom_variables,
      visitor.created_at || new Date(),
      new Date(),
      visitor.site_id || visitor.idsite,
      visitorPrimaryKey
    ])
    return true
  }
}

function shouldIgnoreUsersSettings(siteRecord, parsedEvent) {
  const variableInfoDelimiter = '|'
  const variableValuesDelimiter = '^|^'
  const variablesDelimiter = '*|*'
  if (siteRecord && siteRecord.ignore_users_variables) {
    let shouldIgnore = false
    const variables = siteRecord.ignore_users_variables
    .split(variablesDelimiter)
    .map(v => {
      const i = v.split(variableValuesDelimiter)
      return {attribute: i[0], value: i[1]}
    })

    variables.forEach(v => {
      const attrInfo = v.attribute.split(variableInfoDelimiter)
      const internalVal = attrInfo[0]
      const type = attrInfo[1]
      const valToCheck = v.value
      switch (type) {
        case 'Custom Variable':
          for (const _key in parsedEvent.cvars) {
            const index = _key.replace(/^(cvar)(\d+)(_name)$/, (match, p1, p2) => p2)
            const cvarVal = parsedEvent.cvars[_key]
            if (index && cvarVal === internalVal) {
              if (parsedEvent.cvars[`cvar${index}_value`] === valToCheck)
                shouldIgnore = true
            }
          }
          break
        case 'Salesforce Field':
          // TODO implement SFDC fields
          break
      }
    })
    return shouldIgnore
  }
  return false
}

function insertQuery() {
  return `
    insert into visitors (
      visitor_id,
      visitor_fname,
      visitor_lname,
      visitor_name,
      visitor_email,
      visitor_first_visit,
      visitor_last_visit,
      visitor_photo_url,
      first_visit,
      last_visit,
      signup_date,
      customer_account_id,
      customer_user_id,
      customer_account_name,
      is_internal,
      is_internal_override,
      customer_signup_date,
      cvar1_name,
      cvar1_value,
      cvar2_name,
      cvar2_value,
      cvar3_name,
      cvar3_value,
      cvar4_name,
      cvar4_value,
      cvar5_name,
      cvar5_value,
      cvar6_name,
      cvar6_value,
      cvar7_name,
      cvar7_value,
      cvar8_name,
      cvar8_value,
      cvar9_name,
      cvar9_value,
      cvar10_name,
      cvar10_value,
      cvar11_name,
      cvar11_value,
      cvar12_name,
      cvar12_value,
      cvar13_name,
      cvar13_value,
      cvar14_name,
      cvar14_value,
      cvar15_name,
      cvar15_value,
      cvar16_name,
      cvar16_value,
      cvar17_name,
      cvar17_value,
      cvar18_name,
      cvar18_value,
      cvar19_name,
      cvar19_value,
      cvar20_name,
      cvar20_value,
      last_browser_name,
      last_browser_version,
      last_os_name,
      custom_variables,
      created_at,
      updated_at,
      idsite
    ) values (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,
      $14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,
      $27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39,
      $40,$41,$42,$43,$44,$45,$46,$47,$48,$49,$50,$51,$52,
      $53,$54,$55,$56,$57,$58,$59,$60,$61,$62,$63,$64
    )
  `
}

function updateQuery(idOrUserId='id') {
  return `
    update visitors set
      visitor_id = $1,
      visitor_fname = $2,
      visitor_lname = $3,
      visitor_name = $4,
      visitor_email = $5,
      visitor_first_visit = $6,
      visitor_last_visit = $7,
      visitor_photo_url = $8,
      first_visit = $9,
      last_visit = $10,
      signup_date = $11,
      customer_account_id = $12,
      customer_user_id = $13,
      customer_account_name = $14,
      is_internal = $15,
      is_internal_override = $16,
      customer_signup_date = $17,
      cvar1_name = $18,
      cvar1_value = $19,
      cvar2_name = $20,
      cvar2_value = $21,
      cvar3_name = $22,
      cvar3_value = $23,
      cvar4_name = $24,
      cvar4_value = $25,
      cvar5_name = $26,
      cvar5_value = $27,
      cvar6_name = $28,
      cvar6_value = $29,
      cvar7_name = $30,
      cvar7_value = $31,
      cvar8_name = $32,
      cvar8_value = $33,
      cvar9_name = $34,
      cvar9_value = $35,
      cvar10_name = $36,
      cvar10_value = $37,
      cvar11_name = $38,
      cvar11_value = $39,
      cvar12_name = $40,
      cvar12_value = $41,
      cvar13_name = $42,
      cvar13_value = $43,
      cvar14_name = $44,
      cvar14_value = $45,
      cvar15_name = $46,
      cvar15_value = $47,
      cvar16_name = $48,
      cvar16_value = $49,
      cvar17_name = $50,
      cvar17_value = $51,
      cvar18_name = $52,
      cvar18_value = $53,
      cvar19_name = $54,
      cvar19_value = $55,
      cvar20_name = $56,
      cvar20_value = $57,
      last_browser_name = $58,
      last_browser_version = $59,
      last_os_name = $60,
      custom_variables = $61,
      created_at = $62,
      updated_at = $63
    where
      idsite = $64 and
      ${(['customer_user_id', 'user_id'].includes(idOrUserId)) ? 'CUSTOMER_USER_ID' : 'id'} = $13
  `
}

// This creates a summation of raw custom variables between two
// source raw custom variable objects
// The "moreSignificantObj" will have its numbers/indices adjusted to be higher
// than the "lessSignificantObj"
//
// Structure of both input objects
// { '1': [key1, value1], '2': [key2, value2], ... }
function mergeTwoSetsOfRawCvars(lessSignificantObj, moreSignificantObj) {
  if(!lessSignificantObj || Object.keys(lessSignificantObj).length === 0)
    return moreSignificantObj
  if(!moreSignificantObj || Object.keys(moreSignificantObj).length === 0)
    return lessSignificantObj

  const highestNumInLessSigObj = Math.max(...Object.keys(lessSignificantObj).map(i => parseInt(i)))
  let cursor = highestNumInLessSigObj + 1
  const newMoreSigObj = Object.values(moreSignificantObj).reduce((obj, val) => {
    obj[`${cursor}`] = val
    cursor++
    return obj
  }, {})

  return Object.assign(lessSignificantObj, newMoreSigObj)
}

// Turn a key/value representation of cvars into the raw input
// we get from the tracking code.
function reverseParseCvars(cvarsObj) {
  let iterator = 1
  return Object.keys(cvarsObj).reduce((newObj, key) => {
    newObj[`${iterator}`] = [key, cvarsObj[key]]
    iterator++
    return newObj
  }, {})
}

function parseCvars(cvars, data={}) {
  const htmlEntities = new HtmlEntities.AllHtmlEntities()

  data['cvars'] = {}
  for (var _index in cvars) {
    const cvar_name = cvars[_index][0]
    const cvar_value = cvars[_index][1]

    if(cvar_value === null){
      cvar_value = ""
    }
    
    if (!tabooCvarList.includes(cvar_value)) {
      data['cvars'][`cvar${_index}_name`] = cvar_name
      data['cvars'][`cvar${_index}_value`] = cvar_value

      if (specialEventColumns.includes(cvar_name)) {
        if (['account_name', 'user_name'].includes(cvar_name)) {
          data[cvar_name] = htmlEntities.decode(cvar_value)
          data[`customer_${cvar_name}`] = htmlEntities.decode(cvar_value)
        } else {
          data[cvar_name] = cvar_value
          data[`customer_${cvar_name}`] = cvar_value
        }
      }
    }
  }
  return data
}