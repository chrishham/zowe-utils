const fs = require('fs-extra')
const path = require('path')
const uuid = require('uuid-random')
const os = require('os')
const { execZoweCommand, execFtpCommand } = require('./support_modules/execCommand.js')

const countFileLines = require('./support_modules/countFileLines.js')

module.exports = (config) => {
  const { encoding } = config

  async function put (source, hostFile, optionsCopy) {
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
      if (!(await pathExists(pdsDataSet))) await execZoweCommand(`zowe zos-files create data-set-partitioned ${pdsDataSet}`, config)
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
        options.size = (Math.ceil(totalRows * options.lrecl * 2 / 839940) + 1) + 'CYL'
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
    } else await execFtpCommand(`put ${sourceFilePath} ${hostFile}`, config)
  }

  async function get (hostFile, localFilePath) {
    const finalLocalFilePath = localFilePath || path.join(os.tmpdir(), 'zowe_' + uuid())
    // await execZoweCommand(`zowe zos-files download data-set "${hostFile}" --file ${finalLocalFilePath} --encoding ${encoding}`, config)
    await execFtpCommand(`get ${hostFile} ${finalLocalFilePath}`, config)
    const jsString = await fs.readFile(finalLocalFilePath, 'utf8')
    if (!localFilePath) await fs.remove(finalLocalFilePath)
    return jsString
  }

  async function del (hostFile) {
    if (!(await pathExists(hostFile))) return
    await execZoweCommand(`zowe zos-files delete data-set "${hostFile}" --for-sure`, config)
  }

  async function list (path) {
    const executionResult = await execZoweCommand(`zowe zos-files list data-set "${path}"`, config)
    const items = executionResult.data.apiResponse.items.map(el => el.dsname)
    return items
  }

  async function pathExists (path) {
    const arrayOfMatches = await list(path)
    if (arrayOfMatches.indexOf(path) === -1) return false
    return true
  }

  return {
    put, get, del, list
  }
}
