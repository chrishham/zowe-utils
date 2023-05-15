const path = require('path')
const zoweUtils = require('../lib/index.js')
const { ZosFtp } = zoweUtils(global.config)
const fs = require('fs-extra')

if (!fs.existsSync(path.join(__dirname, 'bigFile.txt'))) {
  let string = 'This is a really big file !\r\n'
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
        await ZosFtp.del(`${config.user}.ZOWEUTIL.BIN`)
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
    it('should fail when host dataset doesn\'t start with user id', async () => {
      return ZosFtp.put(path.resolve(__dirname, 'local.jcl'), `PD.${config.user}.ZOWEUTIL.FILE`, {
        sourceType: 'localFile',
        recfm: 'FB',
        lrecl: 300
      })
        .then(() => { throw new Error('PUT passed instead of failing') },
          (error) => { error.message.should.contain('Can upload to dataset/PDS starting with') })
    })

    it('should fail when host PDS doesn\'t start with user id', async () => {
      return ZosFtp.put(path.resolve(__dirname, 'local.jcl'), `PD.${config.user}.ZOWEUTIL.PDS(BASIC)`, {
        sourceType: 'localFile',
        recfm: 'FB',
        lrecl: 80,
        directory: 50,
        size: '125CYL'
      })
        .then(() => { throw new Error('PUT passed instead of failing') },
          (error) => { error.message.should.contain('Can upload to dataset/PDS starting with') })
    })

    it('should fail when pds name doesn\'t adhere to MVS naming conventions', async () => {
      return ZosFtp.put(path.resolve(__dirname, 'local.jcl'), `${config.user}.ZOWEUTIL98.PDS(BASIC)`, {
        sourceType: 'localFile',
        recfm: 'FB',
        lrecl: 80,
        directory: 50,
        size: '125CYL'
      })
        .then(() => { throw new Error('PUT passed instead of failing') },
          (error) => { error.message.should.contain('Name doesn\'t adhere to MVS naming conventions') })
    })

    it('should fail when dataset name doesn\'t adhere to MVS naming conventions', async () => {
      return ZosFtp.put(path.resolve(__dirname, 'local.jcl'), `${config.user}.ZOWEU T.SEQ`, {
        sourceType: 'localFile',
        recfm: 'FB',
        lrecl: 80,
        directory: 50,
        size: '125CYL'
      })
        .then(() => { throw new Error('PUT passed instead of failing') },
          (error) => { error.message.should.contain('Name doesn\'t adhere to MVS naming conventions') })
    })

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
        lrecl: 300,
        binary: false
      })
    })

    it('should put local file to z/OS dataset using binary mode', async () => {
      return ZosFtp.put(path.resolve(__dirname, 'local.jcl'), `${config.user}.ZOWEUTIL.BIN`, {
        sourceType: 'localFile',
        recfm: 'FB',
        lrecl: 300,
        binary: true
      })
    })

    it('should put local file to z/OS dataset - no options', async () => {
      return ZosFtp.put(path.resolve(__dirname, 'local.jcl'), `${config.user}.ZOWEUTIL.NOOP`, { sourceType: 'localFile' })
    })

    it('should put big local file to z/OS dataset', async () => {
      return ZosFtp.put(path.resolve(__dirname, 'bigFile.txt'), `${config.user}.ZOWEUTIL.BIGFILE`, {
        sourceType: 'localFile',
        recfm: 'FB',
        lrecl: 300
      })
    })

    // it('should put huge local file to z/OS dataset', async () => {
    //   // 1.048.576 rows
    //   return ZosFtp.put('C:\\Users\\e40274\\Desktop\\U764.FTOP.RISKREP3.ZILLA.txt', `${config.user}.ZOWEUTIL.XXSFILE`, {
    //     sourceType: 'localFile',
    //     recfm: 'FB',
    //     lrecl: 300
    //   })
    // })

    it('should put string to to z/OS dataset', async () => {
      let sampleText = 'I need to have at least 1 newline character \r\n'
      for (let i = 0; i < 5; i++) { sampleText += sampleText }
      return ZosFtp.put(sampleText, `${config.user}.ZOWEUTIL.STRING`, {
        sourceType: 'string',
        recfm: 'FB',
        lrecl: 50
      })
    })
    it('should put string to to z/OS dataset with no new Lines', async () => {
      const sampleText = 'I don\'t need to have at least 1 newline character'
      return ZosFtp.put(sampleText, `${config.user}.ZOWEUTIL.STRING`, {
        sourceType: 'string',
        recfm: 'FB',
        lrecl: 80
      })
    })
    it('should put string to to z/OS pds library with no new Lines', async () => {
      const sampleText = 'I don\'t need to have at least 1 newline character'
      return ZosFtp.put(sampleText, `${config.user}.ZOWEUTIL.PDS(TESTSTR)`, {
        sourceType: 'string',
        recfm: 'FB',
        lrecl: 100
      })
    })
    it('should fail when trying to upload dataset to existing PDS', async () => {
      return ZosFtp.put(path.resolve(__dirname, 'local.jcl'), `${config.user}.ZOWEUTIL.PDS`, {
        sourceType: 'localFile',
        recfm: 'FB',
        lrecl: 80,
        directory: 50,
        size: '125CYL'
      })
        .then(() => { throw new Error('PUT passed instead of failing') },
          (error) => { error.message.should.contain('Cannot upload dataset to a PDS') })
    })
  })

  describe('FTP: Get files from Host', () => {
    it('should get pds member to local dataset', async () => {
      return ZosFtp.get(`${config.user}.ZOWEUTIL.PDS(BASIC)`, path.resolve(__dirname, 'output', 'BASIC.txt'), { mode: 'single', returnString: true })
        .then(console.log)
    })
    it('should get host file to local dataset', async () => {
      return ZosFtp.get(`${config.user}.ZOWEUTIL.FILE`, path.resolve(__dirname, 'output', 'ZOWEUTIL.txt'))
    })
    it('should get host file to local dataset using binary mode', async () => {
      return ZosFtp.get(`${config.user}.ZOWEUTIL.FILE`, path.resolve(__dirname, 'output', 'ZOWEUTIL_Binary.txt'), { binary: true })
    })
    it('should get big host file to local dataset', async () => {
      return ZosFtp.get(`${config.user}.ZOWEUTIL.BIGFILE`, path.resolve(__dirname, 'output', 'BIG_ZOWEUTIL.txt'))
    })
    it('should get host file to javascript string', async () => {
      return ZosFtp.get(`${config.user}.ZOWEUTIL.FILE`)
        .then(result => result.should.be.a('string'))
    })
    it('should download all members of a pds library', async () => {
      return ZosFtp.get(`${config.user}.ZOWEUTIL.PDS`, path.resolve(__dirname, 'output', `${config.user}.ZOWEUTIL.PDS`), { mode: 'all' })
    })
    // it('should upload a dir to a pds library', async () => {
    //   await ZosFtp.uploadPdsLibrary(path.resolve(__dirname, 'output', `${config.user}.ZOWEUTIL.PDS`), `${config.user}.ZOWEUTI2.PDS`, 'all')
    // })
    it.skip('should fail when host PDS doesn\'t start with user id', async () => {
      return ZosFtp.get(`PD.${config.user}.ZOWEUTIL.PDS`, path.resolve(__dirname, 'output', `${config.user}.ZOWEUTIL.PDS`), { mode: 'all' })
        .then(() => { throw new Error('GET passed instead of failing') },
          (error) => { error.message.should.contain('Can download PDS libraries starting with') })
    })
  })

  describe('List Host Files', () => {
    it('should list sequential datasets', async () => {
      return ZosFtp.list(`${config.user}.ZOWEUTIL.FILE`)
        .then(result => {
          // console.log(result)
          result.should.be.a('array')
        })
    })
    it('should list pds dataset', async () => {
      return ZosFtp.list(`${config.user}.ZOWEUTIL.PDS`)
        .then(result => {
          // console.log(result)
          result.should.be.a('array')
        })
    })

    it('should list all pds members', async () => {
      return ZosFtp.listPdsMembers(`${config.user}.ZOWEUTIL.PDS`)
        .then(result => {
          // console.log(result)
          result.should.be.a('array')
        })
    })

    it('should list all pds members that match a pattern', async () => {
      return ZosFtp.listPdsMembers(`${config.user}.ZOWEUTIL.PDS`, 'BAS*')
        .then(result => {
          // console.log(result)
          result.should.be.a('array')
        })
    })
  })

  describe('Check Erros returned', () => {
    it('should fail when wrong credentials are given', async () => {
      const wrongConfig = Object.assign({}, global.config)
      wrongConfig.user = 'NONEXISTENTUSER'
      const ZosFtpWrongCredentials = zoweUtils(wrongConfig).ZosFtp
      return ZosFtpWrongCredentials.list(`${wrongConfig.user}.ZOWEUTIL.PDS`)
        .then(() => { throw new Error('JCL passed instead of failing') },
          (error) => { error.message.should.contain('Wrong/Expired Password or User is not in group IZUUSER') })
    })
    it('should fail when Zosmf is unreachable', async () => {
      const wrongConfig = Object.assign({}, global.config)
      wrongConfig.host = '99.99.99.99'
      const ZosFtpWrongCredentials = zoweUtils(wrongConfig).ZosFtp
      return ZosFtpWrongCredentials.list(`${wrongConfig.user}.ZOWEUTIL.PDS`)
        .then(() => { throw new Error('JCL passed instead of failing') },
          (error) => { error.message.should.contain('Zosmf is not reachable') })
    })
  })
})
