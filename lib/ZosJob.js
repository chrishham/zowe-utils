const EventEmitter = require('events')
const path = require('path')
// const fs = require('fs-extra')
const { exec, which } = require('shelljs')
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

    sub () {
      return new Promise((resolve, reject) => {
        // if (this.ftp) return reject(new Error(`${this.jcl.name}: Cannot resubmit while Job is Running.`))
        // this.status = null
        // this.RC = null
        // this.outlist = null
        // this.id = null
        // let loggingFunction = this.loggingFunction
        // try {
        //   await ftp.put(jclToSubmit, this.jcl.source)
        //   loggingFunction(`${this.jcl.name}:  submitted successfully!`)
        // } catch (error) {
        //   await ftp.end()
        //   this.ftp = null
        //   reject(error)
        // }
        const ZosmfConnectionOptions = `--host ${this.host} --port ${this.port} --user ${this.user} --password ${this.password} --ru false `
        const command =
          `zowe zos-jobs submit local-file "${this.jcl.source}" --directory ${path.join(this.jcl.outlistLocalPath, this.jcl.name)} --rfj ` +
          ZosmfConnectionOptions
        // return resolve(command)
        console.log(command)
        exec(command, { silent: true }, (code, stdout, stderr) => {
          try {
            if (code !== 0) throw new Error(stderr)
            console.log('Program output:', stdout)
            const executionResult = JSON.parse(stdout)
            this.RC = executionResult.data.retcode.split(' ')[1]
            if (this.RC > this.jcl.RC) throw new Error(`Execution RC(${this.RC}) > Expected RC(${this.jcl.RC})`)
            resolve(executionResult)
            // Possible retcodes:
            // 'JCL ERROR','CC 0004'
          } catch (e) {
            reject(new Error(e.message))
          }
        })
      })
    }

    cancel () {
      return new Promise((resolve, reject) => {
        // this.loggingFunction(`${this.jcl.name}: Trying to cancel Job ...`)
        // try {
        //   if (!this.id) throw new Error(`${this.jcl.name}: Cannot cancel => Job is not running.`)
        //   await this.ftp.delete(this.id)
        //   this.loggingFunction(`${this.id}: Cancel successful!`)
        //   await this.ftp.end()
        //   this.status = null
        //   this.RC = null
        //   this.outlist = null
        //   this.id = null
        //   this.ftp = null
        //   resolve()
        // } catch (error) {
        //   this.loggingFunction(`${this.jcl.name}: Cancel failed!`)
        //   reject(error)
        // }
      })
    }
  } // class MainframeJob End

  return ZosJob
}

// async function ftpList (self, subResolve, subReject) {
//   let ftp = self.ftp
//   let loggingFunction = self.loggingFunction
//   try {
//     let res = await ftp.list(self.id)
//     let status = res[1].slice(27, 33)

//     if (status !== self.status) {
//       self.status = status
//       self.emit('status-change', status)
//     }

//     loggingFunction(`${self.id}: status = ${status}`)
//     if (status !== 'OUTPUT') return setTimeout(() => ftpList(self, subResolve, subReject), self.watchJobInterval)
//     let RC = null
//     if (/JCL error/i.test(res[1])) RC = 'JCL Error'
//     else RC = res[1].slice(46, 50)

//     self.RC = RC
//     loggingFunction(`${self.id}: ended with Return Code = ${RC}`)

//     let stream = await ftp.get(self.id + '.x')
//     let outlist = await streamHandler(stream, self.encoding)

//     self.outlist = outlist
//     if (self.jcl.outlistLocalPath) {
//       await fs.outputFile(path.join(self.jcl.outlistLocalPath, `${self.id}_${self.jcl.name}_outlist.txt`), outlist)
//       loggingFunction(`${self.id}: outlist downloaded successfully.`)
//     }
//     if (self.deleteMainframeOutlist) {
//       await ftp.delete(self.id)
//       loggingFunction(`${self.id}: outlist deleted on Z/OS`)
//     }
//     if (RC === 'JCL Error') throw new Error('JCL Error')
//     if (RC > self.jcl.RC) throw new Error(`Execution RC(${RC}) > Expected RC(${self.jcl.RC})`)
//     subResolve({ outlist, RC })
//   } catch (err) {
//     subReject(err)
//   }
//   try {
//     await ftp.end()
//     loggingFunction(`${self.id}: ftp exiting .... ok!`)
//   } catch (e) { }
//   self.ftp = null
//   self.id = null
//   self.status = null
// }
