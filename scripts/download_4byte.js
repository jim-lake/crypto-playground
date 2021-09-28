const async = require('async');
const request = require('request');

let url = `https://www.4byte.directory/api/v1/signatures/`;

console.log('[');
async.forever(
  (done) => {
    const opts = {
      url,
      json: true,
    };
    request(opts, (err, response, body) => {
      const statusCode = response && response.statusCode;
      if (err) {
        console.error('request err:', err, statusCode, body);
      } else if (statusCode === 404) {
        console.error('done: page:', page);
        err = 'done';
      } else if (statusCode < 200 || statusCode > 299) {
        console.error('bad status:', err, statusCode, body);
        err = 'bad_status';
      } else {
        const { count, next, results } = body;
        if (next) {
          url = next;
        } else {
          err = 'done';
        }
        if (results) {
          results.forEach((result) => {
            const { text_signature, hex_signature } = result;
            console.log(
              ` { "hex": "${hex_signature}", "text": "${text_signature}" },`
            );
          });
        }
      }
      done(err);
    });
  },
  (err) => {
    if (err === 'done') {
      console.log(']');
      console.log('');
      console.error('done done, success!');
    } else {
      console.error('done: err:', err);
    }
  }
);
