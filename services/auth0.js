import auth0 from 'auth0-js';
import Cookies from 'js-cookie';
import jwt from 'jsonwebtoken';
import axios from 'axios';

import { getCookieFromReq } from '../helpers/utils';


class Auth {
  constructor(){
      this.auth0 = new auth0.WebAuth({
        domain: 'dev-2bsg3wrj.auth0.com',
        clientID: 'dKFtYDSGMaj3AlqOK69aBzENqT7wvURy',
        redirectUri: 'http://localhost:3000/callback',
        responseType: 'token id_token',
        scope: 'openid profile'
    });
    this.login = this.login.bind(this);
    this.logout = this.logout.bind(this);
    this.handleAuthentication = this.handleAuthentication.bind(this);
  } // auth를 constructor로 만든다  bind(this)를 이용하여, this가 전역객체를 가르키도록 한다

  handleAuthentication() {
    return new Promise((resolve, reject) => {
      this.auth0.parseHash((err, authResult) => {
        if (authResult && authResult.accessToken && authResult.idToken) {
          this.setSession(authResult);
          resolve();
        } else if (err) {
          reject(err);
          console.log(err);
        }
      });
    })
  }

  setSession(authResult) {
    const expiresAt = JSON.stringify((authResult.expiresIn * 1000) + new Date().getTime());

    Cookies.set('jwt', authResult.idToken);
  }

  logout() {
      Cookies.remove('user');
      Cookies.remove('jwt');
      Cookies.remove('expiresAt');

      this.auth0.logout({
          returnTo: '',
          clientID: 'dKFtYDSGMaj3AlqOK69aBzENqT7wvURy'
      })
  }

  login() {
    this.auth0.authorize();
  }

  async getJWKS() {
    const res = await axios.get(`https://dev-2bsg3wrj.auth0.com/.well-known/jwks.json`);
    const jwks = res.data;
    return jwks;
  }
  
  async verifyToken(token){
    if (token){
      const decodedToken = jwt.decode(token, { complete: true });
      const jwks = await this.getJWKS();
     
      const jwk = jwks.keys[0];
      // BUILD CERTIFICATE;
      let cert = jwk.x5c[0];
      cert = cert.match(/.{1,64}/g).join('\n');
      cert = `-----BEGIN CERTIFICATE-----\n${cert}\n-----END CERTIFICATE-----\n`; 
      
      console.log("jwk",jwk .kid);
      console.log("decodedToken",decodedToken.header.kid);

      if (jwk.kid === decodedToken.header.kid) {
        try {
          const verifiedToken = jwt.verify(token, cert);
          const expiresAt = verifiedToken.exp * 1000;

          return (verifiedToken && new Date().getTime() < expiresAt) ? verifiedToken : undefined;
        } catch(err) {
          return console.log(err);
        }
      }
    }
    return undefined;
  }

  async clientAuth() {
    const token = Cookies.getJSON('jwt');
    const verifiedToken = await this.verifyToken(token);

    return verifiedToken;
  }

  async serverAuth(req) {
    if(req.headers.cookie) {
      const token = getCookieFromReq(req, 'jwt');
      const verifiedToken = await this.verifyToken(token)
      return verifiedToken;
    }
    return undefined;
  }

}

const auth0Client = new Auth();

export default auth0Client;