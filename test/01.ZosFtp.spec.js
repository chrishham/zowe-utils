const path = require('path')
const zoweUtils = require('../lib/index.js')
const { ZosFtp } = zoweUtils(config)
const fs = require('fs-extra')

if (!fs.existsSync(path.join(__dirname, 'bigFile.txt'))) {
  let string = 'This is a really big file!\r\n'
  for (let i = 0; i < 20; i++) {
    string += string
  }
  fs.writeFileSync(path.join(__dirname, 'bigFile.txt'), string)
}
describe('ZosFtp Test Suite', () => {
  describe('FTP: Delete Host files', () => {
    it('should delete host file', async () => {
      try {
        await ZosFtp.del(`${config.user}.ZOWEUTIL.FILE`)
        await ZosFtp.del(`${config.user}.ZOWEUTIL.BIGFILE`)
        await ZosFtp.del(`${config.user}.ZOWEUTIL.NOOP`)
        await ZosFtp.del(`${config.user}.ZOWEUTIL.STRING`)
        await ZosFtp.del(`${config.user}.NON.EXISTENT.PDS`)
      } catch (error) {
        let message = error.message
        if (/PASS command failed/.test(message)) {
          message = `Failed to connect (User:${config.user} / Password : ${config.password}).`
        }
        logError(message)
        process.exit(1)
      }
    })

    it('should delete pds library', async () => {
      return ZosFtp.del(`${config.user}.ZOWEUTIL.PDS`)
    })
  })

  describe('FTP: Put files to Host', () => {
    it('should put local file to PDS library', async () => {
      return ZosFtp.put(path.resolve(__dirname, 'local.jcl'), `${config.user}.ZOWEUTIL.PDS(BASIC)`, {
        sourceType: 'localFile',
        recfm: 'FB',
        lrecl: 80,
        directory: 50,
        size: '125CYL'
      })
    })

    it('should put local file to z/OS dataset', async () => {
      return ZosFtp.put(path.resolve(__dirname, 'local.jcl'), `${config.user}.ZOWEUTIL.FILE`, {
        sourceType: 'localFile',
        recfm: 'FB',
        lrecl: 300
      })
    })

    it('should put local file to z/OS dataset - no options', async () => {
      return ZosFtp.put(path.resolve(__dirname, 'local.jcl'), `${config.user}.ZOWEUTIL.NOOP`, { sourceType: 'localFile' })
    })

    it.skip('should put big local file to z/OS dataset', async () => {
      return ZosFtp.put(path.resolve(__dirname, 'bigFile.txt'), `${config.user}.ZOWEUTIL.BIGFILE`, {
        sourceType: 'localFile',
        recfm: 'FB',
        lrecl: 300
      })
    })

    it('should put string to to z/OS dataset', async () => {
      let sampleText = 'I need to have at list 1 newline character \r\n'
      for (let i = 0; i < 5; i++) { sampleText += sampleText }
      return ZosFtp.put(sampleText, `${config.user}.ZOWEUTIL.STRING`, {
        sourceType: 'string',
        recfm: 'FB',
        lrecl: 50
      })
    })
  })

  describe('FTP: Get files from Host', () => {
    it('should get pds member to local dataset', async () => {
      return ZosFtp.get(`${config.user}.ZOWEUTIL.PDS(BASIC)`, path.resolve(__dirname, 'output', 'BASIC.txt'))
    })
    it('should get host file to local dataset', async () => {
      return ZosFtp.get(`${config.user}.ZOWEUTIL.FILE`, path.resolve(__dirname, 'output', 'ZOWEUTIL.txt'))
    })
    it.skip('should get big host file to local dataset', async () => {
      return ZosFtp.get(`${config.user}.ZOWEUTIL.BIGFILE`, path.resolve(__dirname, 'output', 'BIG_ZOWEUTIL.txt'))
    })
    it('should get host file to javascript string', async () => {
      return ZosFtp.get(`${config.user}.ZOWEUTIL.FILE`)
        .then(result => result.should.be.a('string'))
    })
  })

  describe('List Host Files', () => {
    it('should list pds members', async () => {
      return ZosFtp.list(`${config.user}.ZOWEUTIL.PDS`)
        .then(result => result.should.be.a('array'))
    })
  })
})
