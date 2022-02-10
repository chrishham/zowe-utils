const path = require('path')
const fs = require('fs-extra')
const zoweUtils = require('../lib/index.js')
const basicJCL = `${jobStatement} \n// EXEC PGM=IEFBR14`

const { ZosJob } = zoweUtils(config)

fs.writeFileSync(path.join(__dirname, 'local.jcl'), basicJCL.replace(/\n/g, '\r\n'))

describe.only('SubJob: Submitting Job from localFile', () => {
  const jcl = {
    name: 'BASIC',
    description: 'Basic Jcl',
    RC: '0000',
    source: path.resolve(__dirname, 'local.jcl'), // Absolute path of local file ,has to be utf8 and \r\n
    outlistLocalPath
  }

  it('should end up with RC=0000', async () => {
    const job = new ZosJob(jcl)
    await job.sub()
    job.RC.should.be.equal('0000')
  })
})

describe('SubJob: Reject invalid JCL source', () => {
  it('should reject invalid JCL source', () => {
    const jcl = {
      name: 'NONJCL',
      description: 'Invalid Jcl',
      RC: '0004',
      source: `${jobStatement} \n//this is not a jcl \n`,
      outlistLocalPath
    }
    const job = new ZosJob(jcl)
    return job.sub()
      .then(
        () => { throw new Error('Cancel succeeded instead of failing') },
        () => { }
      )
  })
})

describe('SubJob: Delete mainframe outlist', () => {
  it('should delete mainframe outlist', () => {
    const configModified = Object.assign({}, config)
    configModified.deleteMainframeOutlist = true
    delete configModified.encoding
    delete configModified.watchJobInterval
    delete configModified.loggingFunction
    delete configModified.port
    const ZosJobModified = zoweUtils(configModified).ZosJob
    const jcl = {
      name: 'BASIC',
      description: 'Basic Jcl',
      source: basicJCL,
      RC: '0000',
      outlistLocalPath
    }
    const job = new ZosJobModified(jcl)
    return job.sub()
  })
})
