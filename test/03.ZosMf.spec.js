const zoweUtils = require('../lib/index.js')
const { ZosMf } = zoweUtils(config)

describe('SubJob: Submitting Job from string.', () => {
  it('should end up with RC=0000', async () => {
    const status = await ZosMf.checkStatus()
    // console.log(status)
    if (!status.success) throw new Error('')
  })
})
