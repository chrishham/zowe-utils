
// https://www.ibm.com/docs/en/zos/2.3.0?topic=ftp-mvs-naming-conventions

// Data set names cannot be longer than 44 characters.
// Each qualifier in a data set name, or each member name for a partitioned data set, must conform to the following:
// No longer than 8 characters.
// Begin with a letter or the special characters
// $, @, or #.
// Contain only numbers, letters, or the special characters
// $, @, #, or -.

// /^[a-zA-Z$@#][a-zA-Z0-9$@#-]{0,7}/

module.exports = hostFile => {
  if (hostFile.length > 44) return false
  const hostFileQualifiers = hostFile.split('.')
  // check last qualifier to decide if it is a pds library e.x. 'pds(mymember)
  // so that the last item in the array gets replaced with pds last
  // qualifier and  member name
  const resultRegexParentheses = /(\w+)\(([^)]+)\)/.exec(hostFileQualifiers.slice(-1))
  if (resultRegexParentheses) {
    hostFileQualifiers.splice(-1, 1, resultRegexParentheses[1], resultRegexParentheses[2])
  }
  //   console.log(hostFileQualifiers)

  for (let i = 0; i < hostFileQualifiers.length; i++) {
    // console.log(/^[a-zA-Z$@#][a-zA-Z0-9$@#-]{0,7}$/.test(hostFileQualifiers[i]))
    if (!/^[a-zA-Z$@#][a-zA-Z0-9$@#-]{0,7}$/.test(hostFileQualifiers[i])) return false
  }
  return true
}
