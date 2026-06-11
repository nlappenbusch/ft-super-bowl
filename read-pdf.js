const fs = require('fs');
const pdfParse = require('pdf-parse');

let dataBuffer = fs.readFileSync('./angebot.pdf');

pdfParse(dataBuffer).then(function(data) {
    console.log(data.text);
}).catch(function(error) {
    console.error(error);
});
