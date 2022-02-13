const { exec } = require('shelljs')
const fs = require('fs-extra')
const path = require('path')
const uuid = require('uuid-random')
const os = require('os')

module.exports = (config) => {
  const { host, port, user, password, encoding } = config

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
      if (!(await pathExists(pdsDataSet))) await execCommand(`zowe zos-files create data-set-partitioned ${pdsDataSet}`)
    }

    if (hostFileType === 'dataset') {
      // if dataset exists delete it
      if (await pathExists(hostFile)) await del(hostFile)

      if (!options.lrecl) options.lrecl = 80

      if (!options.size) { // calculate the primary cylinders
        const totalRows = options.sourceType === 'string'
          ? source.match(/\n/g).length + 1
          : await countFileLines(source) + 1
        options.size = (Math.ceil(totalRows * options.lrecl * 2 / 839940) + 1) + 'CYL'
      }

      options.blksize = 0

      let extraOptions = ''
      for (const key in options) {
        if (key === 'sourceType') continue
        extraOptions += ' --' + key.toLowerCase() + ' ' + options[key]
      }
      await execCommand(`zowe zos-files create data-set-sequential "${hostFile}" ${extraOptions}`)
    }

    await execCommand(`zowe zos-files upload file-to-data-set "${sourceFilePath}" "${hostFile}" --encoding ${encoding}`)

    if (options.sourceType === 'string') await fs.remove(sourceFilePath)
  }

  async function get (hostFile, localFilePath) {
    const finalLocalFilePath = localFilePath || path.join(os.tmpdir(), 'zowe_' + uuid())
    await execCommand(`zowe zos-files download data-set "${hostFile}" --file ${finalLocalFilePath} --encoding ${encoding}`)
    const jsString = await fs.readFile(finalLocalFilePath, 'utf8')
    if (!localFilePath) await fs.remove(finalLocalFilePath)
    return jsString
  }

  async function del (hostFile) {
    if (!(await pathExists(hostFile))) return
    await execCommand(`zowe zos-files delete data-set "${hostFile}" --for-sure`)
  }

  async function list (path) {
    const executionResult = await execCommand(`zowe zos-files list data-set "${path}"`)
    const items = executionResult.data.apiResponse.items.map(el => el.dsname)
    return items
  }

  function execCommand (command) {
    return new Promise((resolve, reject) => {
      const hrstart = process.hrtime()
      const ZosmfConnectionOptions = ` --host ${host} --port ${port} --user ${user} --password ${password} --ru false `
      const finalCommand = command + ZosmfConnectionOptions + ' --rfj'

      console.log(finalCommand)
      exec(finalCommand, { silent: true }, function (code, stdout, stderr) {
        executionTime(hrstart)
        if (code !== 0) return reject(stdout)
        resolve(JSON.parse(stdout))
      })
    })
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

function countFileLines (filePath) {
  return new Promise((resolve, reject) => {
    let lineCount = 0
    fs.createReadStream(filePath)
      .on('data', (buffer) => {
        let idx = -1
        lineCount-- // Because the loop will run once for idx=-1
        do {
          idx = buffer.indexOf(10, idx + 1)
          lineCount++
        } while (idx !== -1)
      }).on('end', () => {
        resolve(lineCount)
      }).on('error', reject)
  })
}

function executionTime (hrstart) {
  const hrend = process.hrtime(hrstart)
  const executionMins = (hrend[0] / 60).toFixed(0)
  const executionSecs = (hrend[0] % 60).toFixed(0)
  console.log(`${executionMins} minute${executionMins === '1' ? '' : 's'} and ${executionSecs} second${executionSecs === '1' ? '' : 's'}`)
}
