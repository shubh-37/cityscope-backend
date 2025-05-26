
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const auth = require('../middleware/auth');
const AWS = require('aws-sdk');

 function usersRoutes(app, Models) {
  AWS.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_ACCESS_SECRET_KEY,
    region: process.env.AWS_ACCESS_REGION
  });
  
  const s3 = new AWS.S3();  
  const User = Models.User;
    app.post('/api/users/signup', async (req, res) => {
      try {
        const { username, name, mobile, password } = req.body;
    
        // Validation
        if (!username || !mobile || !password) {
          return res.status(400).json({ error: 'All fields are required' });
        }
    
        if (password.length < 6) {
          return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }
    
        if (!/^[0-9]{10}$/.test(mobile)) {
          return res.status(400).json({ error: 'Mobile number must be 10 digits' });
        }
    
        // Check if user already exists
        const existingUser = await User.findOne({
          $or: [{ username }, { mobile }]
        });
    
        if (existingUser) {
          return res.status(400).json({ error: 'Username or mobile already exists' });
        }
    
        // Hash password
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);
    
        // Create user
        const user = new User({
          username,
          name,
          mobile,
          password, // Store original password as requested
          hashedPassword
        });
    
        await user.save();
    
        // Generate JWT token
        const token = jwt.sign(
          { userId: user._id },
          process.env.JWT_SECRET,
          { expiresIn: '7d' }
        );
    
        res.status(201).json({
          message: 'User created successfully',
          token,
          user: {
            id: user._id,
            username: user.username,
            name: user.name,
            mobile: user.mobile,
            profilePic: user.profilePic,
            bio: user.bio
          }
        });
    
      } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });
    app.post('/api/users/login', async (req, res) => {
      try {
        const { username, password } = req.body;
    
        if (!username || !password) {
          return res.status(400).json({ error: 'Username and password are required' });
        }
    
        // Find user by username or mobile
        const user = await User.findOne({
          $or: [{ username }, { mobile: username }]
        });
    
        if (!user) {
          return res.status(401).json({ error: 'Invalid credentials' });
        }
    
        // Check password
        const isPasswordValid = await bcrypt.compare(password, user.hashedPassword);
        if (!isPasswordValid) {
          return res.status(401).json({ error: 'Invalid credentials' });
        }
    
        // Generate JWT token
        const token = jwt.sign(
          { userId: user._id },
          process.env.JWT_SECRET,
          { expiresIn: '7d' }
        );
    
        res.json({
          message: 'Login successful',
          token,
          user: {
            id: user._id,
            username: user.username,
            mobile: user.mobile,
            profilePic: user.profilePic,
            bio: user.bio,
            name: user.name,
            createdAt: user.createdAt
          }
        });
    
      } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });
    app.get('/api/users/profile', auth, async (req, res) => {
      try {
        const user = await User.findById(req.user._id)
          .select('-hashedPassword -password')
          .populate('posts');
    
        res.json({
          user: {
            id: user._id,
            username: user.username,
            mobile: user.mobile,
            profilePic: user.profilePic,
            bio: user.bio,
            posts: user.posts,
            createdAt: user.createdAt
          }
        });
    
      } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });
    app.get('/api/users/authenticate', auth, async (req, res) => {
      return res.status(200).json({ message: 'Authenticated' });
    });
    app.put('/api/users/profile', auth, async (req, res) => {
      const { bio } = req.body;
      const userInstance = await User.findById(req.user.userId);
      if(!userInstance){
        return res.status(404).json({ error: 'User not found' });
      }
      if(bio){
        userInstance.bio = bio;
      }
      let uploadResult = null;
      if(req.files && req.files.length > 0){
        const profilePic = req.files[0];
        const uploadParams = {
          Bucket: process.env.S3_BUCKET_NAME,
          Key: `users/${req.user.userId}.jpg`,
          Body: profilePic.buffer,
          ContentType: profilePic.mimetype,
        };
        uploadResult = await s3.upload(uploadParams).promise(); 
      }
      if(uploadResult){
        userInstance.profilePic = uploadResult.Location;
      }
      await userInstance.save();
      return res.status(200).json({ user: userInstance });
    });
}

module.exports = { usersRoutes };