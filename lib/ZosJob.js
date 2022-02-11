const EventEmitter = require('events')
const path = require('path')
const fs = require('fs-extra')
const uuid = require('uuid-random')
const os = require('os')
const { exec, which } = require('async-shelljs')
const delay = require('delay')
const compareSemver = require('compare-semver')

if (!which('zowe')) throw new Error('Zowe-cli is not installed!')
const zoweCliVersion = exec('zowe -V -g', { silent: true }).stdout
console.log('@zowe/cli version : ', zoweCliVersion)
const minZoweCliVersion = ['6.25.1']
if (compareSemver.lt(zoweCliVersion, minZoweCliVersion)) throw new Error(`zowe-cli version installed :${zoweCliVersion}. Minimum version required : ${minZoweCliVersion[0]} `)

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
      } else throw new Error('Unsupported JCL sourcetype ', this.jcl.sourceType)

      console.log(sourceFilePath)
      const executionResult = await execCommand(`zowe zos-jobs submit ${action} "${sourceFilePath}"`, this)
      this.loggingFunction(`${this.jcl.name}:  submitted successfully!`)
      if (this.jcl.sourceType === 'string') await fs.remove(sourceFilePath)

      this.id = executionResult.data.jobid
      this.status = executionResult.data.status
      this.emit('job-id', this.id)

      return watchJob(this)
    }

    async cancel () {
      this.loggingFunction(`${this.jcl.name}: Trying to cancel Job ...`)
      if (!this.id) throw new Error(`${this.jcl.name}: Cannot cancel => Job is not running.`)

      const executionResult = await execCommand(`zowe zos-jobs cancel job ${this.id}`, this)

      console.log(executionResult)
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

  const outlist = null
  // const stream = await ftp.get(self.id + '.x')
  // const outlist = await streamHandler(stream, self.encoding)

  // await execCommand(`zowe zos-jobs download output ${self.id} --ojd`, this)

  // self.outlist = outlist
  // if (self.jcl.outlistLocalPath) {
  //   await fs.outputFile(path.join(self.jcl.outlistLocalPath, `${self.id}_${self.jcl.name}_outlist.txt`), outlist)
  //   loggingFunction(`${self.id}: outlist downloaded successfully.`)
  // }
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

async function execCommand (command, self) {
  const ZosmfConnectionOptions = ` --host ${self.host} --port ${self.port} --user ${self.user} --password ${self.password} --ru false `
  const finalCommand = command + ZosmfConnectionOptions + ' --rfj'

  console.log(finalCommand)
  const { code, stdout, stderr } = exec(finalCommand, { silent: true })

  if (code !== 0) throw new Error(stderr)
  return JSON.parse(stdout)
}
