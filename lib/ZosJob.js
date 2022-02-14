const EventEmitter = require('events')
const path = require('path')
const fs = require('fs-extra')
const uuid = require('uuid-random')
const os = require('os')
const { exec } = require('child_process')
const delay = require('delay')
const glob = require('glob-promise')

module.exports = (config) => {
  class ZosJob extends EventEmitter {
    constructor (jcl) {
      super()
      this.jcl = Object.assign({}, jcl)
      this.host = config.host
      this.port = config.port
      this.user = config.user
      this.password = config.password
      this.status = null
      this.RC = null
      this.outlist = null
      this.id = null
      this.encoding = config.encoding
      this.watchJobInterval = (config.watchJobInterval && config.watchJobInterval >= 1000) || 1000
      this.deleteMainframeOutlist = config.deleteMainframeOutlist || true
      this.loggingFunction = config.loggingFunction || console.log
    }

    async sub () {
      if (this.status) throw new Error(`${this.jcl.name}: Cannot resubmit while Job is Running.`)
      this.status = 'Submitting'
      this.RC = null
      this.outlist = null
      this.id = null
      let sourceFilePath, action

      if (this.jcl.sourceType === 'string') {
        sourceFilePath = path.join(os.tmpdir(), 'zowe_' + uuid())
        await fs.writeFile(sourceFilePath, this.jcl.source)
        action = 'local-file'
      } else if (this.jcl.sourceType === 'localFile') {
        sourceFilePath = this.jcl.source
        action = 'local-file'
      } else if (this.jcl.sourceType === 'hostFile') {
        sourceFilePath = this.jcl.source
        action = 'data-set'
      } else throw new Error('Unsupported JCL sourcetype ' + this.jcl.sourceType)

      const executionResult = await execCommand(`zowe zos-jobs submit ${action} "${sourceFilePath}"`, this)
      if (this.jcl.sourceType === 'string') await fs.remove(sourceFilePath)

      this.id = executionResult.data.jobid
      this.status = executionResult.data.status
      this.loggingFunction(`${this.jcl.name}:  submitted successfully! JobId : ${this.id}`)

      this.emit('job-id', this.id)

      return watchJob(this)
    }

    async cancel () {
      // Doesn't work https://github.com/zowe/zowe-cli/issues/1161#issuecomment-943206346
      this.loggingFunction(`${this.jcl.name}: Trying to cancel Job ...`)
      if (!this.id) throw new Error(`${this.jcl.name}: Cannot cancel => Job is not running.`)

      await execCommand(`zowe zos-jobs cancel job ${this.id}`, this)

      this.loggingFunction(`${this.id}: Cancel successful!`)

      this.status = null
      this.RC = null
      this.outlist = null
      this.id = null

      this.loggingFunction(`${this.jcl.name}: Cancel failed!`)
    }
  } // class MainframeJob End

  return ZosJob
}

async function watchJob (self) {
  await delay(self.watchJobInterval)
  const loggingFunction = self.loggingFunction
  const executionResult = await execCommand(`zowe zos-jobs view job-status-by-jobid  ${self.id}`, self)
  const status = executionResult.data.status

  if (status !== self.status) {
    self.status = status
    self.emit('status-change', status)
  }

  loggingFunction(`${self.id}: status = ${status}`)
  if (status !== 'OUTPUT') return watchJob(self)

  // Possible retcodes:
  // 'JCL ERROR','CC 0004'
  const RC = executionResult.data.retcode === 'JCL ERROR'
    ? executionResult.data.retcode
    : executionResult.data.retcode.split(' ')[1]

  self.RC = RC
  loggingFunction(`${self.id}: ended with Return Code = ${RC}`)

  const tempOutlistPath = path.join(os.tmpdir(), 'zowe_' + uuid())
  await execCommand(`zowe zos-jobs download output ${self.id} --directory ${tempOutlistPath}  --ojd`, self)
  const outlist = await buildOutlist(tempOutlistPath)
  await fs.remove(tempOutlistPath)
  self.outlist = outlist
  if (self.jcl.outlistLocalPath) {
    await fs.outputFile(path.join(self.jcl.outlistLocalPath, `${self.id}_${self.jcl.name}_outlist.txt`), outlist)
    loggingFunction(`${self.id}: outlist downloaded successfully.`)
  }
  // if (self.deleteMainframeOutlist) {
  //   await ftp.delete(self.id)
  //   loggingFunction(`${self.id}: outlist deleted on Z/OS`)
  // }

  if (RC === 'JCL ERROR') throw new Error('JCL Error')
  if (RC > self.jcl.RC) throw new Error(`Execution RC(${RC}) > Expected RC(${self.jcl.RC})`)

  self.id = null
  self.status = null

  return { outlist, RC }
}

function execCommand (command, self) {
  return new Promise((resolve, reject) => {
    const hrstart = process.hrtime()
    const ZosmfConnectionOptions = ` --host ${self.host} --port ${self.port} --user ${self.user} --password ${self.password} --ru false `
    const finalCommand = command + ZosmfConnectionOptions + ' --rfj'

    console.log(finalCommand)

    exec(finalCommand, { silent: true }, function (error, stdout, stderr) {
      if (error) return reject(new Error(stderr))
      const stdoutJson = JSON.parse(stdout)
      executionTime(hrstart)
      if (stdoutJson.exitCode !== 0) return reject(stdoutJson.stderr)
      resolve(stdoutJson)
    })
  })
}

async function buildOutlist (tempOutlistPath) {
  let outlist = ''
  const txtFiles = await glob(tempOutlistPath + '/**/*.txt')
  for (const txtFile of txtFiles) {
    const txtFileContent = await fs.readFile(txtFile, 'utf8')
    if (txtFileContent) outlist += txtFileContent
  }
  return outlist
}

function executionTime (hrstart) {
  const hrend = process.hrtime(hrstart)
  const executionMins = (hrend[0] / 60).toFixed(0)
  const executionSecs = (hrend[0] % 60).toFixed(0)
  console.log(`${executionMins} minute${executionMins === '1' ? '' : 's'} and ${executionSecs} second${executionSecs === '1' ? '' : 's'}`)
}
