const { exec } = require('child_process')
const executionTime = require('./executionTime.js')
const translateErrors = require('./translateErrors.js')

module.exports = (command, config) => {
  return new Promise((resolve, reject) => {
    const hrstart = process.hrtime()
    const ZosmfConnectionOptions = ` --host ${config.host} --port ${config.port} --user ${config.user} --password ${config.password} --ru false `
    const finalCommand = command + ZosmfConnectionOptions + ' --rfj'

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
