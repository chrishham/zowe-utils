module.exports = (message) => {
  if (message.includes('is not recognized as an internal')) return 'zowe-cli is not installed!'
  if (message.includes('could not be initiated to host')) return 'Zosmf is not reachable!'
  if (message.includes('Username or password are not valid or expired')) return 'Wrong/Expired Password or User is not in group IZUUSER!'
  return message
}
