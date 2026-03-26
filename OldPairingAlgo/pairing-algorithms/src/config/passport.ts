import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as FacebookStrategy } from 'passport-facebook';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import User, { UserRole } from '../models/user.model';
import config from './index';

// JWT strategy for token authentication
passport.use(
  new JwtStrategy(
    {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.jwtSecret
    },
    async (payload, done) => {
      try {
        const user = await User.findById(payload.id);
        if (!user) return done(null, false);
        return done(null, payload);
      } catch (error) {
        return done(error, false);
      }
    }
  )
);

// Google OAuth strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      callbackURL: process.env.GOOGLE_CALLBACK_URL
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Find or create user
        let user = await User.findOne({ email: profile.emails?.[0].value });
        
        if (!user) {
          user = new User({
            email: profile.emails?.[0].value,
            name: profile.displayName,
            password: 'SOCIAL_AUTH_' + Math.random().toString(36).substring(2),
            role: UserRole.PLAYER,
            googleId: profile.id
          });
          await user.save();
        } else if (!user.googleId) {
          // Update existing user with Google ID
          user.googleId = profile.id;
          await user.save();
        }
        
        return done(null, user);
      } catch (error) {
        return done(error as Error);
      }
    }
  )
);

// Facebook OAuth strategy
passport.use(
  new FacebookStrategy(
    {
      clientID: process.env.FACEBOOK_APP_ID as string,
      clientSecret: process.env.FACEBOOK_APP_SECRET as string,
      callbackURL: process.env.FACEBOOK_CALLBACK_URL,
      profileFields: ['id', 'emails', 'name']
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Find or create user
        let user = await User.findOne({ email: profile.emails?.[0].value });
        
        if (!user) {
          user = new User({
            email: profile.emails?.[0].value,
            name: `${profile.name?.givenName} ${profile.name?.familyName}`,
            password: 'SOCIAL_AUTH_' + Math.random().toString(36).substring(2),
            role: UserRole.PLAYER,
            facebookId: profile.id
          });
          await user.save();
        } else if (!user.facebookId) {
          // Update existing user with Facebook ID
          user.facebookId = profile.id;
          await user.save();
        }
        
        return done(null, user);
      } catch (error) {
        return done(error as Error);
      }
    }
  )
);

export default passport;