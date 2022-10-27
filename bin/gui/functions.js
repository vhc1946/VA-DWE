const  path = require('path'),
fs = require('fs'),
os= require('os'),
reader = require('xlsx'),
request = require('request');

var kill = require('tree-kill');
const {exec} = require('child_process');
const nodemailer=require('nodemailer');

// REPO ////////////////////////////////////////////////////////////////////////
var {aappuser} = require('../repo/ds/users/vogel-users.js');
var {vjwomap} = require('../repo/ds/wos/vogel-wos.js');
var {excelTOjson}=require('../repo/tools/ioconvert/excel-io.js');
var {VGMailer} = require('../repo/tools/mail/vogel-mail-service.js'); //include NODEMAILER
////////////////////////////////////////////////////////////////////////////////
var auser = aappuser(); //initialize the app user object

var mailsettings = require(path.join(auser.cuser.spdrive,'Vogel - Service/Daily WOs/data/mail-settings.json'));
var emailtemproot = path.join(auser.cuser.spdrive,'Vogel - Service/Documents & Protocol/Email Templates/html/');
var dailywofile = path.join(auser.cuser.spdrive,'Vogel - Service/Daily WOs/Reports/DailyWOs.xlsx'); //daily WO report path
var dailywofailpath = path.join(auser.cuser.spdrive,'Vogel - Service/Daily WOs/Reports/Fail Reports');
var dailywo = excelTOjson(dailywofile,false,'MAIN',vjwomap); //daily WOs converted to array
var techlist = excelTOjson(path.join(auser.cuser.spdrive,'Vogel - Service/Daily WOs/data/TechList.xlsx'),false,'TECHS');


var RunDailyWoEmails=(list)=>{
    for(let x=0;x<list.length;x++){
        let info={
        email:list[x].custEmail,
        name:'',
        tech:list[x].tech,
        time:list[x].strtTime,
        date:new Date(list[x].strtDate+'Z12:00:00'),
        cat:list[x].cat,
        dept:list[x].dept
        }


        var day = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
        var month = ["January","February","March","April","May","June","July","August","September","October","November","December"];

        let apptmonth = month[info.date.getMonth()].toUpperCase();
        let apptday = day[info.date.getDay()].toUpperCase();
        let apptdate = info.date.getDate();

        switch (info.cat){  //Sets cleaner Subject Lines
          case 'Duct Clean':
              info.cat = 'Duct Cleaning';
              break;
          case 'Classic RM':
          case 'Premium RM':
          case 'Ultimate RM':
          case '1st Year/PV':
              info.cat = 'Maintenance';
              break;
          case 'Flat Rate':
          case 'Clean/Check':
          case 'Warranty':
          case 'Return Trip':
          case 'T&M':
              info.cat = 'Service';
              break;
        }

        var mailbody;

        for(let eg in mailsettings.emailgroups){   // Sets correct email template based on department and category
          if(mailsettings.emailgroups[eg].groups.includes(list[x].cat)){
              if(info.dept == 300 || info.dept == 350){                  // If a residential call, use residential templates
                info.name = toTitleCase(list[x].custName).split(', ')[1];
                mailbody = require('cheerio').load(fs.readFileSync(emailtemproot + mailsettings.emailgroups[eg].temp));
              }else if(info.dept == 400 || info.dept == 450){            // Only sending to commercial service right now, not install (filtered in mail-settings)
                info.name = list[x].custName;
                mailbody = require('cheerio').load(fs.readFileSync(emailtemproot + mailsettings.emailgroups[eg].ctemp));
              }
              info.pic = emailtemproot + 'images/' + mailsettings.emailgroups[eg].pic;
              info.sig = emailtemproot + 'images/' + mailsettings.emailgroups[eg].sig;
          }
        }

        mailbody('#client-name').text(info.name);   // Sets info into tagged spaces on the Word doc
        mailbody('#appt-date').text(apptday + ", " + apptmonth + " " + apptdate);

        dailyWOMailer.sendMail({
          to:info.email,
          subject:'Vogel ' + info.cat + ' Appointment',
          html: mailbody.html(),
          attachments: [
              {
              path: info.sig,
              cid: 'vogellogo@vogelheating.com'
              },
              {
              path: info.pic,
              cid: 'installvehicle@vogelheating.com'
              }
          ],
          id:list[x].id
        },list.length,DailyWoLogger);
    }
}

function toTitleCase(str) {
    var lcStr = str.toLowerCase();
    return lcStr.replace(/(?:^|\s)\w/g, function(match) {
    return match.toUpperCase();
    });
}

var dwofaillogopens=null;

var DailyWoLogger=(log=null,hastried=false)=>{
    console.log(hastried,log);
    let nlist = [];
    for(let y=0;y<log.fails.length;y++){
        for(let x=0;x<dailywo.length;x++){
        if(log.fails[y].id==dailywo[x].id){nlist.push(dailywo[x])}//convert to excel format
        }
    }
    let failws = reader.utils.json_to_sheet(nlist);

    nlist = [];
    for(let y=0;y<log.success.length;y++){
        for(let x=0;x<dailywo.length;x++){
        if(log.success[y].id==dailywo[x].id){nlist.push(dailywo[x])}//convert to excel format
        }
    }
    let sucws = reader.utils.json_to_sheet(nlist);

    let wb = reader.utils.book_new();
    reader.utils.book_append_sheet(wb,failws,'FAILS');
    reader.utils.book_append_sheet(wb,sucws,'SUCCESS');
    
    var dailywofailfile = path.join(dailywofailpath, `DailyWOsFail-${new Date().getTime()}.xlsx`);
    
    try{
        reader.writeFileSync(wb,dailywofailfile);    //save the fails and successes to log file
        dwofaillogopens=exec(dailywofailfile.replace(/ /g,'^ '));

    }catch{
        console.log('Write error');
        kill(dwofaillogopens.pid,()=>{
          console.log("HAS killed");
          dwofaillogopens=null;
          setTimeout(()=>{
            if(!hastried){DailyWoLogger(log,true);}
          },2000); //wait for child process to fully close, then try to write again
        });
    }
}


var RunWoSalesRepEmails=(list)=>{   // Sets list of upcoming jobs for each consultant
    let rlist={};
    let runcnt = 0;
    for(let x=0;x<list.length;x++){
        try{
        rlist[list[x].salesRep].push(repemailitem(list[x]));
        }catch{
        rlist[list[x].salesRep]=[];
        rlist[list[x].salesRep].push(repemailitem(list[x]));
        }
    }
    for(let r in rlist){
        if(mailsettings.reps[r]&&mailsettings.reps[r]!=undefined){runcnt++};//get the test count
    }
    for(let r in rlist){
        if(mailsettings.reps[r]&&mailsettings.reps[r]!=undefined){
        repMailer.sendMail({
            to:mailsettings.reps[r],
            subject:"Upcoming Service",
            html:tableEle(rlist[r])
        },runcnt);
        }
    }
}


  //Tech functions ///////////////////

  var GETtech=(tid=null,prop='name')=>{
    for(let x=0;x<techlist.length;x++){
      if(techlist[x].id==tid){
        if(prop=='name'){return techlist[x].name}
        else{return techlist[x].phone}
      }
    }
    return tid
  }

  ////////////////////////////////////
  var repemailitem=(re=null)=>{
    if(!re||re==undefined){re={}}
    return{
      'WO NUM':re.id ||'',
      'Customer':re.custName||'',
      'Phone1':re.custPhone1||'',
      'Phone2':re.custPhone2||'',
      'Email':re.custEmail||'',
      'Created By':re.createBy||'',
      'Tech Name':GETtech(re.tech),
      'Tech Phone':GETtech(re.tech,'phone'),
      'Cat':re.cat||'',
      'Descr':re.woDescr||''
    }
  }


  var tableEle=(list)=>{  // Creates a table-based email body for delivering the consultant's job list
    let cont = '<table style="border-spacing:0">';
    for(let x=0;x<list.length;x++){
      let row = '<tr>'
      let header='';
      if(x==0){header='<tr>'}
      for(let l in list[x]){
        if(x==0){header+='<td style="border-bottom:1px solid black;">'+l+'</td>'}
        row+=('<td style="border-bottom:1px solid black;">'+list[x][l]+'</td>');
      }
      if(x==0){header+='</tr>';cont+=header;}
      row+='</tr>';
      cont+=row;
    }
    cont+='</table>';
    return cont;
  }

  var repMailer = new VGMailer(nodemailer,mailsettings);
  var dailyWOMailer = new VGMailer(nodemailer,mailsettings);

  module.exports={
    mailsettings,
    dailywo,
    repMailer,
    dailyWOMailer,
    RunWoSalesRepEmails,
    RunDailyWoEmails
  }
