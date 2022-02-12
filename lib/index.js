const { exec, which } = require('async-shelljs')
const compareSemver = require('compare-semver')
const ZosJobModule = require('./ZosJob')
const ZosFtpModule = require('./ZosFtp')

if (!which('zowe')) throw new Error('Zowe-cli is not installed!')
const zoweCliVersion = exec('zowe -V -g', { silent: true }).stdout
console.log('@zowe/cli version : ', zoweCliVersion)
const minZoweCliVersion = ['6.25.1']
if (compareSemver.lt(zoweCliVersion, minZoweCliVersion)) throw new Error(`zowe-cli version installed :${zoweCliVersion}. Minimum version required : ${minZoweCliVersion[0]} `)

module.exports = config => {
  if (!config) throw new Error('You have to supply a config object.')
  config = Object.assign({}, config)
  if (!config.user || !config.password || !config.host) throw new Error('Config object is missing some properties.')
  config.port = config.port || '30443'
  config.encoding = config.encoding || 'UTF8'
  const ZosJob = ZosJobModule(config)
  const ZosFtp = ZosFtpModule(config)
  return { ZosJob, ZosFtp }
}
