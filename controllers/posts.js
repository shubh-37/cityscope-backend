const auth = require('../middleware/auth');
const AWS = require('aws-sdk');
const multer = require('multer');
  
function postsRoutes(app, Models) {
  AWS.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_ACCESS_SECRET_KEY,
    region: process.env.AWS_ACCESS_REGION
  });
  
  const s3 = new AWS.S3();  
  const Post = Models.Post;
  const User = Models.User;
  const upload = multer(); 

  app.post('/api/posts', auth, upload.array('images', 5), async (req, res) => {
      try {
        console.log('Body:', req.body);
        console.log('Files:', req.files);
        
        const { content, type, location } = req.body;
        
       
        if (!content || content.length === 0 || !type || type.length === 0) {
          return res.status(400).json({ error: 'Content and type are required' });
        }

        if (content.length > 280) {
          return res.status(400).json({ error: 'Content must be 280 characters or less' });
        }
        
        const validTypes = ['recommendation', 'ask_for_help', 'local_update', 'event_announcement'];
        if (!validTypes.includes(type)) {
          return res.status(400).json({ error: 'Invalid post type' });
        }
        
        let imageUrls = [];
        
        if (req.files && req.files.length > 0) {
          for (const file of req.files) {
            const uploadParams = {
              Bucket: process.env.S3_BUCKET_NAME,
              Key: `posts/${Date.now()}-${req.user.userId}-${Math.random().toString(36).substring(7)}.jpg`,
              Body: file.buffer,
              ContentType: file.mimetype,
            };
            
            try {
              const uploadResult = await s3.upload(uploadParams).promise();
              imageUrls.push(uploadResult.Location);
            } catch (uploadError) {
              console.error('S3 upload error:', uploadError);
              return res.status(500).json({ error: 'Failed to upload image' });
            }
          }
        }
        console.log(req.user);
        const post = new Post({
          content,
          type,
          location,
          author: req.user.userId,
          images: imageUrls
        });

        await post.save();

        // Add post to user's posts array
        await User.findByIdAndUpdate(req.user._id, {
          $push: { posts: post._id }
        });

        // Populate author details for response
        await post.populate('author', 'username profilePic');

        // Send success response
        res.status(201).json({
          message: 'Post created successfully',
          success: true,
        });
        
      } catch (error) {
        console.error('Create post error:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
  });

  app.post('/api/posts/:postId/like', auth, async (req, res) => {
    try {
      const { postId } = req.params;
      const userId = req.user.userId;
  
      const post = await Post.findById(postId);
      if (!post) {
        return res.status(404).json({ error: 'Post not found' });
      }
  
      // Check if user already liked the post
      const existingLikeIndex = post.likes.findIndex(
        like => like.user.toString() === userId.toString()
      );
  
      if (existingLikeIndex > -1) {
        // Unlike the post
        post.likes.splice(existingLikeIndex, 1);
        await post.save();
        
        res.json({
          message: 'Post unliked successfully',
          liked: false,
          likesCount: post.likes.length
        });
      } else {
        // Like the post
        post.likes.push({ user: userId });
        await post.save();
        
        res.json({
          message: 'Post liked successfully',
          liked: true,
          likesCount: post.likes.length
        });
      }
  
    } catch (error) {
      console.error('Like/Unlike post error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/api/posts/:postId/comment', auth, async (req, res) => {
    try {
      const { postId } = req.params;
      const { content } = req.body;
      const userId = req.user.userId;
  
      if (!content) {
        return res.status(400).json({ error: 'Comment content is required' });
      }
  
      if (content.length > 200) {
        return res.status(400).json({ error: 'Comment must be 200 characters or less' });
      }
  
      const post = await Post.findById(postId);
      if (!post) {
        return res.status(404).json({ error: 'Post not found' });
      }
  
      // Add comment
      const comment = {
        user: userId,
        content,
        createdAt: new Date()
      };
  
      post.comments.push(comment);
      await post.save();
  
      // Populate the comment with user details
      await post.populate('comments.user', 'username profilePic');
  
      const newComment = post.comments[post.comments.length - 1];
  
      res.status(201).json({
        message: 'Comment added successfully',
        comment: newComment
      });
  
    } catch (error) {
      console.error('Comment post error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  app.get('/api/posts', async (req, res) => {
    try {
      const { type, location, page = 1, limit = 10 } = req.query;
      console.log(type, location, page, limit);
      
      // Build filter object
      const filter = {};
      if (type && type !== 'undefined') {
        const validTypes = ['recommendation', 'ask_for_help', 'local_update', 'event_announcement'];
        if (!validTypes.includes(type)) {
          return res.status(400).json({ error: 'Invalid post type' });
        }
        filter.type = type;
      }
      if (location && location !== 'undefined') {
        filter.location = { $regex: location, $options: 'i' }; // Case insensitive search
      }
  
      // Calculate pagination
      const skip = (parseInt(page) - 1) * parseInt(limit);
  
      // Get posts with filters
      const posts = await Post.find(filter)
        .populate('author', 'username profilePic name')
        .populate('comments.user', 'username profilePic name')
        .populate('likes.user', 'username')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));
  
      const totalPosts = await Post.countDocuments(filter);
  
      res.json({
        posts,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalPosts / parseInt(limit)),
          totalPosts,
          hasNextPage: skip + posts.length < totalPosts,
          hasPrevPage: parseInt(page) > 1
        }
      });
  
    } catch (error) {
      console.error('Filter posts error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/posts/user', auth, async (req, res) => {
    try {
      const posts = await Post.find({ author: req.user.userId })
        .populate('author', 'username profilePic')
        .populate('comments.user', 'username profilePic')
        .populate('likes.user', 'username')
        .sort({ createdAt: -1 });
  
      res.json({ posts });
    } catch (error) {
      console.error('Get user posts error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
}

module.exports = { postsRoutes };