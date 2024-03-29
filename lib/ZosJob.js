const EventEmitter = require('events')
const path = require('path')
const fs = require('fs-extra')
const uuid = require('uuid-random')
const os = require('os')
const delay = require('delay')
const buildOutlist = require('./support_modules/buildOutlist.js')
const { execZoweCommand } = require('./support_modules/execCommand.js')

module.exports = (config) => {
  class ZosJob extends EventEmitter {
    constructor (jcl) {
      super()
      this.jcl = Object.assign({}, jcl)
      this.host = config.host
      this.port = config.port
      this.user = config.user
      this.password = config.password
      this.status = null // SUBMITTING INPUT ACTIVE OUTPUT CANCELLED
      this.RC = null
      this.outlist = null
      this.id = null
      this.encoding = config.encoding
      this.watchJobInterval = (config.watchJobInterval && config.watchJobInterval >= 1000) || 1000
      this.deleteMainframeOutlist = config.deleteMainframeOutlist || true
      this.loggingFunction = config.loggingFunction || console.log
    }

    async sub () {
      if (
        this.status === 'SUBMITTING' ||
        this.status === 'INPUT' ||
        this.status === 'ACTIVE') {
        throw new Error(`${this.jcl.name}: Cannot resubmit while Job is Running.`)
      }
      this.status = 'SUBMITTING'
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

      if (action === 'local-file' && this.jcl.outlistLocalPath) {
        await fs.copy(sourceFilePath, path.join(this.jcl.outlistLocalPath, `${this.jcl.name}_source.txt`))
        this.loggingFunction(`${this.id}: source JCL write successfully.`)
      }

      const executionResult = await execZoweCommand(`zowe zos-jobs submit ${action} "${sourceFilePath}"`, this)
      if (this.jcl.sourceType === 'string') await fs.remove(sourceFilePath)

      this.id = executionResult.data.jobid
      this.status = executionResult.data.status
      this.loggingFunction(`${this.jcl.name}:  submitted successfully! JobId : ${this.id}`)

      this.emit('job-id', this.id)

      return watchJob(this)
    }

    async cancel () {
      this.loggingFunction(`${this.jcl.name}: Trying to cancel Job ...`)
      if (
        !this.status ||
        this.status === 'OUTPUT' ||
        this.status === 'CANCELLED') {
        throw new Error(`${this.jcl.name}:Cannot cancel => Job is not running.`)
      }

      while (!this.id) {
        await delay(this.watchJobInterval)
      }

      await execZoweCommand(`zowe zos-jobs cancel job ${this.id} --modifyVersion "2.0"`, this)

      this.status = 'CANCELLED'

      await execZoweCommand(`zowe zos-jobs delete job ${this.id} --modifyVersion "2.0"`, this)

      this.loggingFunction(`${this.id}: Cancel successful!`)

      // this.RC = null
      // this.outlist = null
      // this.id = null

      // this.loggingFunction(`${this.jcl.name}: Cancel failed!`)
    }
  } // class MainframeJob End

  return ZosJob
}

async function watchJob (self) {
  await delay(self.watchJobInterval)
  const loggingFunction = self.loggingFunction
  const executionResult = await execZoweCommand(`zowe zos-jobs view job-status-by-jobid  ${self.id}`, self)
  if (self.status === 'CANCELLED') return
  const status = executionResult.data.status

  if (status !== self.status) {
    self.status = status
    self.emit('status-change', status)
  }

  loggingFunction(`${self.id}: status = ${status}`)
  if (status !== 'OUTPUT') return watchJob(self)

  // Possible retcodes:
  // 'JCL ERROR','CC 0004','ABENDU3333'

  const retcodeSecondPart = executionResult.data.retcode.split(' ')[1]
  let jobHasFailed, RC

  if (/^-?\d+$/.test(retcodeSecondPart)) {
    RC = retcodeSecondPart
    jobHasFailed = RC > self.jcl.RC
  } else {
    RC = executionResult.data.retcode
    jobHasFailed = true
  }

  self.RC = RC
  loggingFunction(`${self.id}: ended with Return Code = ${RC}`)

  const tempOutlistPath = path.join(os.tmpdir(), 'zowe_' + uuid())
  await execZoweCommand(`zowe zos-jobs download output ${self.id} --directory "${tempOutlistPath}"  --ojd`, self)
  const outlist = await buildOutlist(tempOutlistPath)
  await fs.remove(tempOutlistPath)
  self.outlist = outlist
  if (self.jcl.outlistLocalPath) {
    await fs.outputFile(path.join(self.jcl.outlistLocalPath, `${self.id}_${self.jcl.name}_outlist.txt`), outlist)
    loggingFunction(`${self.id}: outlist downloaded successfully.`)
  }
  if (self.deleteMainframeOutlist) {
    await execZoweCommand(`zowe zos-jobs delete job ${self.id} --modifyVersion "2.0"`, self)
    loggingFunction(`${self.id}: outlist deleted on Z/OS`)
  }

  if (jobHasFailed) throw new Error(RC)

  return outlist
}
