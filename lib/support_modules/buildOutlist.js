const fs = require('fs-extra')
const glob = require('glob-promise')

module.exports = async (tempOutlistPath) => {
  let outlist = ''
  const txtFiles = await glob(tempOutlistPath + '/**/*.txt')
  for (const txtFile of txtFiles) {
    const txtFileContent = await fs.readFile(txtFile, 'utf8')
    if (txtFileContent) outlist += txtFileContent
  }
  return outlist.split(/\r?\n/).filter(line => line.trim() !== '').join('\n')
}
