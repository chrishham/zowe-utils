const execCommand = require('./support_modules/execCommand.js')

module.exports = (config) => {
  async function checkStatus (path) {
    return await execCommand('zowe zosmf check status ', config)
  }

  return {
    checkStatus
  }
}
