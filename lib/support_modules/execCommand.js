const { exec, spawn } = require('child_process')
const fs = require('fs-extra')
const path = require('path')
const uuid = require('uuid-random')
const os = require('os')
const executionTime = require('./executionTime.js')
const translateErrors = require('./translateErrors.js')

const execZoweCommand = (command, config) => {
  return new Promise((resolve, reject) => {
    const hrstart = process.hrtime()
    const ZosmfConnectionOptions = ` --host ${config.host} --port ${config.port} --user ${config.user} --password ${config.password} --ru false `
    const finalCommand = command + ZosmfConnectionOptions + ' --rfj' // + ' --response-timeout 600'

    console.log(finalCommand)
    exec(finalCommand, { silent: true }, function (error, stdout, stderr) {
      executionTime(hrstart)
      // console.log('Zowe-utils Error : ', error && error.message)
      // console.log('Zowe-utils Stderr : ', stderr)
      // console.log('Zowe-utils Stdout : ', stdout)
      // stdout is not returned only if zowe-cli is not installed
      if (!stdout) return reject(new Error(translateErrors(error.message)))

      const stdoutJson = JSON.parse(stdout)
      if (stdoutJson.exitCode !== 0) {
        return reject(
          new Error(translateErrors(error.message +
           stdoutJson.error.msg +
           stdoutJson.error.additionalDetails
          )))
      }
      resolve(stdoutJson)
    })
  })
}

const execFtpCommand = async (command, config) => {
  const finalCommand =
  `open ${config.host}\n` +
  `${config.user}\n` +
  `${config.password}\n` +
  'cd ..\n' +
  `${command}\n` +
  'quit'
  const commandFilePath = path.join(os.tmpdir(), 'zowe_' + uuid())
  await fs.writeFile(commandFilePath, finalCommand)
  console.log(finalCommand)
  return new Promise((resolve, reject) => {
    const hrstart = process.hrtime()
    const ftp = spawn('ftp', [`-s:${commandFilePath}`])

    ftp.stdout.on('data', function (data) {
      // console.log('stdout: ' + data)
    })

    ftp.stderr.on('data', async function (data) {
      console.log('stderr: ' + data)
      executionTime(hrstart)
      await fs.remove(commandFilePath)
      reject(data)
    })

    ftp.on('exit', async function (code) {
      console.log('child process exited with code ' + code)
      executionTime(hrstart)
      await fs.remove(commandFilePath)
      resolve()
    })
  })
}

module.exports = { execZoweCommand, execFtpCommand }
