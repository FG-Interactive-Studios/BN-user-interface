import assert from 'node:assert/strict';
const hits = [];
let access='first';
globalThis.fetch = async (url, options = {}) => {
  hits.push([String(url),options.method,options.headers?.Authorization,options.body]);
  const path=String(url).replace(/^.*\/api/, '');
  if(path==='/auth/login') return Response.json({accessToken:'first',refreshToken:'r1'});
  if(path==='/users/me') return options.headers?.Authorization==='Bearer first'
    ? Response.json({code:'UNAUTHORIZED'},{status:401}) : Response.json({id:1,nickname:'Naval'});
  if(path==='/auth/refresh') {const token=JSON.parse(options.body).refreshToken; assert.equal(token,'r1'); return Response.json({accessToken:'second',refreshToken:'r2'});}
  if(path==='/auth/logout')return new Response(null,{status:204});
  throw Error(`Unexpected request: ${path}`);
};
const api=await import('../src/prototype/client.js');
await api.login('a@example.com','examplepassword');
assert.equal(api.isAuthenticated(),true);
const profile=await api.get('/users/me');
assert.equal(profile.nickname,'Naval');
assert.equal(api.getSession().refreshToken,'r2');
assert.equal(hits.filter(x=>x[0].endsWith('/auth/refresh')).length,1);
assert.equal(hits.at(-1)[2],'Bearer second');
await api.logout();assert.equal(api.isAuthenticated(),false);
assert.equal(hits.find(x=>x[0].endsWith('/auth/logout'))[2],'Bearer second');
console.log('TidePoint client: login, refresh rotativo, replay e logout: OK');
