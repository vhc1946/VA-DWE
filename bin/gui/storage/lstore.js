/* Lstore
    File to hold all of the LocalStorage variables
    located on the browser.
*/

var usersls = {
  curruser: 'app-curruser'
}
var quotesls = {
  userquotes: 'rrq-userquotes',
  lastquote:'rrq-lastquote',
  quotetoload:'rrq-quotetoload'
}

module.exports = {
  usersls,
  quotesls
}
