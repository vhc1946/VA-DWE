const  path = require('path'),
fs = require('fs'),
os= require('os'),
request = require('request');

// REPO ////////////////////////////////////////////////////////////////////////
var {aappuser} = require('./bin/repo/ds/users/vogel-users.js');
var {app,ipcMain,BrowserWindow,viewtools} = require('./bin/repo/tools/box/electronviewtool.js');
var {ObjList}=require('./bin/repo/tools/box/vg-lists.js');

////////////////////////////////////////////////////////////////////////////////

var mainf=require('./bin/gui/functions.js');
var {loginroutes}=require('./bin/routes.js');

//Midleware //////////////////////////
var controlsroot = path.join(__dirname,'/controllers/'); //dir path to views
//dir path to bin files
var appset = require('./app/settings.json');
//appset.dev.on = true;
var auser = aappuser(); //initialize the app user object

var dailywologfile = path.join(__dirname,'db/dailywolog.json');

var mainv; //holds the main BrowserWindow


/* LANDING PAGE

The landing page will more often be the login screen
This login screen can be skipped by editing the
appset.dev.on = true. This will default to main.html
If the developer wants to skip to a page, the
appset.dev.page = '' can have a desired page file
name
*/
app.on('ready',(eve)=>{
  if(!appset.dev.on){
    mainv = viewtools.loader(controlsroot + 'login.html',750,750,true,false);
  }else{appset.dev.page==''?mainv = viewtools.loader(controlsroot+'main.html'):viewtools.loader(controlsroot+appset.dev.page,750,750,true,true)}
});

/* APP login
data:{
user:'',
pswrd:''
}

Recieve a user name and password from login form AND
attach the application auth code to it. The api is
queried to check both the auth code and the user
credentials.

If the access/login to the api is a success, the
appset.users is checked for a match to the user name.

If the user is found in appset.users, that users group
view (appset.groups.main) 'dash' is loaded
*/
ipcMain.on(loginroutes.submit,(eve,data)=>{
if(appset.users[data.uname]!=undefined){ //check to see if username matches app settings
let user = data;
data.auth = appset.auth; //attach the application auth code
request.post({ //call to api to check access
 url:appset.apicon + 'login',
 json:true,
 body:data
},(err,res,body)=>{
 if(err){ //could not connect with api
   /* The api is not responding OR the computer is not connected
   */
   auser.uname = user.uname;
   auser.config = appset.users[auser.uname];

   viewtools.swapper(mainv,controlsroot + appset.groups[auser.config.group].main);

   //eve.sender.send(loginroutes.submit,{status:false,msg:'API not connected',user:null})
 }else{
   if(body.user && body.user!=undefined){
     if(appset.users[body.user.id]!=undefined){
       auser.uname = body.user.id; //set user name
       auser.pswrd = body.user.pswrd; //set password
       auser.config = appset.users[auser.uname];

       viewtools.swapper(mainv,controlsroot + appset.groups[auser.config.group].main);
     }else{eve.sender.send(loginroutes.submit,{status:false,msg:'Not an app user',user:null})}
   }else{eve.sender.send(loginroutes.submit,body);}
 }
});
}else{eve.sender.send(loginroutes.submit,{status:false,msg:'Not an app user',user:null})}
});

/* Run Daily Wo Emails
REQUEST:
data{
confirm: FALSE/TRUE (used to confirm run IF alread run that day)
runner: '' (employee id)
ran: FALSE/TRUE (used to say it has started)
}

RESPOND:
{
msg:'' ()
confirm:FALSE/TRUE (FAlSE if client still needs to confirm)
ran: FALSE/TRUE (if it did start the run)
}
*/
ipcMain.on('RUN-DailyWOEmails',(eve,data)=>{
  var rundata = {
    date:new Date().toISOString().split('T')[0],
    runner:auser.cuser.uname|| ''
  }
  let runlog = require(dailywologfile); //get daily run log
  if(!data.confirm){
    data.confirm = true;
    for(let x=0;x<runlog.runs.length;x++){//check to see if report was run today
      if(runlog.runs[x].date==rundata.date){
        data.msg='NEED confrimation';
        data.confirm=false;
        data.ran = false;
        eve.sender.send('RUN-DailyWOEmails',data); //already ran today, ask client for confirmation
        break;
      }
    }
  }
  if(data.confirm){
    let dlist = new ObjList(mainf.dailywo);
    mainf.RunDailyWoEmails(dlist.TRIMlist(mainf.mailsettings.fltrs));
    //mainf.RunWoSalesRepEmails(dlist.TRIMlist(mainf.mailsettings.fltrs));

    runlog.runs.push(rundata);
    fs.writeFileSync(dailywologfile,JSON.stringify(runlog));
    data.msg='Daily Emails have been Sent';
    data.confirm = true;
    data.ran = true;

    eve.sender.send('RUN-DailyWOEmails',data);
  }
});

ipcMain.on('CHECK-DailyWOEmails',(eve,data)=>{
  if(mainf.repMailer.running || mainf.dailyWOMailer.running){      // Still running
    eve.sender.send('CHECK-DailyWOEmails',{finished:false,msg:'Still Running'});
  }else{
    eve.sender.send('CHECK-DailyWOEmails',{finished:true,msg:'Done Running'});
  }//done running
});


ipcMain.on('Error-Alert', (eve,data)=>{
  console.log('Error Alert', data);
  eve.sender.send('Error-Alert', data);
});
