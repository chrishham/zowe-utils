module.exports = (hrstart) => {
  const hrend = process.hrtime(hrstart)
  const executionMins = (hrend[0] / 60).toFixed(0)
  const executionSecs = (hrend[0] % 60).toFixed(0)
  console.log(`${executionMins} minute${executionMins === '1' ? '' : 's'} and ${executionSecs} second${executionSecs === '1' ? '' : 's'}`)
}
