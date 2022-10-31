const { execZoweCommand } = require('./support_modules/execCommand.js')

module.exports = (config) => {
  async function checkStatus (path) {
    return await execZoweCommand('zowe zosmf check status ', config)
  }

  return {
    checkStatus
  }
}
