const fs = require('fs-extra')
const iconvlite = require('iconv-lite')
const path = require('path')
const uuid = require('uuid-random')
const os = require('os')
const { execZoweCommand, execFtpCommand } = require('./support_modules/execCommand.js')

const countFileLines = require('./support_modules/countFileLines.js')

module.exports = (config) => {
  const { encoding } = config

  async function put (source, hostFile, optionsCopy) {
    const regex = new RegExp('^' + config.user, 'i')
    if (!regex.test(hostFile)) throw new Error('Can upload to dataset/PDS starting with ' + config.user)

    const options = Object.assign({}, optionsCopy)

    if (!options) throw new Error('Missing required argument: option')
    if (!options.sourceType) throw new Error('Missing required option: sourceType')
    if (options.sourceType !== 'string' && options.sourceType !== 'localFile') {
      throw new Error('Invalid sourcetype : ' + options.sourceType + ' (Valid sourceTypes: string & localFile)')
    }

    let sourceFilePath

    if (options.sourceType === 'string') {
      sourceFilePath = path.join(os.tmpdir(), 'zowe_' + uuid())
      await fs.writeFile(sourceFilePath, source)
    }

    if (options.sourceType === 'localFile') {
      sourceFilePath = source
    }

    const hostFileParenthesisIndex = hostFile.indexOf('(')
    const hostFileType = hostFileParenthesisIndex === -1 ? 'dataset' : 'pds'

    if (hostFileType === 'pds') {
      // create pds library before proceeding
      const pdsDataSet = hostFile.slice(0, hostFileParenthesisIndex)
      await checkPds(pdsDataSet)
    }

    if (hostFileType === 'dataset') {
      // if dataset exists delete it
      if (await pathExists(hostFile)) await del(hostFile)

      if (!options.lrecl) options.lrecl = 80

      if (!options.size) { // calculate the primary cylinders
        let totalRows
        if (options.sourceType === 'string') {
          const numberOfNewLines = source.match(/\n/g)
          if (numberOfNewLines) totalRows = numberOfNewLines.length + 1
          else totalRows = 1
        } else totalRows = await countFileLines(source) + 1
        console.log({ totalRows })
        options.size = (Math.ceil(totalRows * options.lrecl / 839940) / 2 + 1)
        options['secondary-space'] = Math.ceil(Math.min(options.size * 0.10, 300))
        options.size = Math.min(options.size, 4369) + 'CYL'
      }

      options.blksize = 0

      let extraOptions = ''
      for (const key in options) {
        if (key === 'sourceType') continue
        extraOptions += ' --' + key.toLowerCase() + ' ' + options[key]
      }
      await execZoweCommand(`zowe zos-files create data-set-sequential "${hostFile}" ${extraOptions}`, config)
    }
    if (options.sourceType === 'string') {
      await execZoweCommand(`zowe zos-files upload file-to-data-set "${sourceFilePath}" "${hostFile}" --encoding ${encoding}`, config)
      await fs.remove(sourceFilePath)
    } else await execFtpCommand(`put "${sourceFilePath}" "${hostFile}"`, config)
  }

  async function get (hostFile, localFilePath, mode = 'single', returnString = false) {
    const finalLocalFilePath = localFilePath || path.join(os.tmpdir(), 'zowe_' + uuid())
    if (mode === 'all') {
      const regex = new RegExp('^' + config.user, 'i')
      if (!regex.test(hostFile)) throw new Error('Can download PDS libraries starting with ' + config.user)
      return await execZoweCommand(`zowe zos-files download all-members "${hostFile}" --directory "${finalLocalFilePath}" --encoding ${encoding} --extension ''`, config)
    }
    if (!localFilePath) { // Return a string using zowe
      await execZoweCommand(`zowe zos-files download data-set "${hostFile}" --file "${finalLocalFilePath}" --encoding ${encoding}`, config)
      const jsString = await fs.readFile(finalLocalFilePath, 'utf8')
      await fs.remove(finalLocalFilePath)
      return jsString
    }
    await execFtpCommand(`get "${hostFile}" "${finalLocalFilePath}"`, config)
    if (returnString) {
      const content = await fs.readFile(finalLocalFilePath)
      const jsString = iconvlite.decode(content, encoding === '875' ? 'ISO-8859-7' : encoding)
      return jsString
    }
  }

  async function del (hostFile) {
    if (!(await pathExists(hostFile))) return
    await execZoweCommand(`zowe zos-files delete data-set "${hostFile}" --for-sure`, config)
  }

  async function list (path) {
    const executionResult = await execZoweCommand(`zowe zos-files list data-set "${path}" --attributes`, config)
    const items = executionResult.data.apiResponse.items.map(el => {
      return {
        dsname: el.dsname,
        dsntp: el.dsntp
      }
    })
    return items
  }

  async function listPdsMembers (path, pattern = '*') {
    const executionResult = await execZoweCommand(`zowe zos-files list all-members "${path}" --pattern "${pattern}" `, config)
    const items = executionResult.data.apiResponse.items.map(el => {
      return {
        dsname: el.member
      }
    })
    return items
  }

  // Fails with EDC5003I Truncation of a record occurred during an I/O operation at some members
  // async function uploadPdsLibrary (localFilePath, pdsDataSet) {
  //   await checkPds(pdsDataSet)
  //   await execZoweCommand(`zowe zos-files upload dir-to-pds "${localFilePath}" "${pdsDataSet}"  --encoding ${encoding} `, config)
  // }

  async function pathExists (path) {
    const arrayOfMatches = await list(path)
    if (arrayOfMatches.find(el => el.dsname === path)) return true
    return false
  }

  async function checkPds (pdsDataSet) {
    if (!(await pathExists(pdsDataSet))) {
      await execZoweCommand(
      `zowe zos-files create data-set-partitioned "${pdsDataSet}" --primary-space 50 --directory-blocks 5000 --block-size 32720`
      , config)
    }
  }

  return {
    put, get, del, list, listPdsMembers
  }
}
