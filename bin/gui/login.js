const {ipcRenderer} = require('electron');
var {DropNote} = require ('../bin/repo/gui/js/modules/vg-poppers.js');

var {loginroutes}=require('../bin/routes.js');
var {usersls}=require('../bin/gui/storage/lstore.js');
var $ = require('jquery');

var lodom={//dom names for form
  cont:'login-area',
  inputs:{
    uname:'login-username',
    pswrd:'login-password',
  },
  actions:{
    submit:'login-submit',
  }
}

document.getElementById(lodom.actions.submit).addEventListener('click',(ele)=>{
  let lform = { //object to collect form
    uname:String(document.getElementById(lodom.inputs.uname).value).toUpperCase(),
    pswrd:document.getElementById(lodom.inputs.pswrd).value
  }
  localStorage.setItem(usersls.curruser,JSON.stringify(lform));
  ipcRenderer.send(loginroutes.submit,lform);
});

var cuser = JSON.parse(localStorage.getItem(usersls.curruser));

document.getElementById(lodom.inputs.uname).value = cuser.uname!=undefined?cuser.uname:'';

ipcRenderer.on(loginroutes.submit,(eve,data)=>{
  if(!data.user){
    DropNote('tr',data.msg,'red');
    localStorage.setItem(usersls.curruser,null);
  }else{DropNote('tr',data.msg,'green');}
});
