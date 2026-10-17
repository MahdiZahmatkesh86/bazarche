const nodemailer = require('nodemailer');

let transporter = null;
if(process.env.SMTP_HOST && process.env.SMTP_USER){
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
}

async function sendMail({ to, subject, text, html }){
  if(!transporter){
    console.log('\n========== [MAIL - DEV MODE] ==========');
    console.log('To:', to);
    console.log('Subject:', subject);
    console.log('Body:', text || html);
    console.log('=======================================\n');
    return { dev:true };
  }
  return transporter.sendMail({
    from: process.env.SMTP_FROM || 'Bazaarche <noreply@bazaarche.local>',
    to, subject, text, html
  });
}
module.exports = { sendMail };