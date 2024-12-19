const Blog = require("../model/blogSchema");
const mongoose = require("mongoose");

// Create a blog
exports.createBlog = async (req, res) => {
  const { title, description, url, image, show, publishDate } = req.body;

  try {
    if (!title || !description || !url || !image) {
      return res.status(400).json({ message: "Title, Description, URL, and Image are required" });
    }

    // Set default values for 'show' and 'publishDate' if not provided
    const blog = new Blog({
      title,
      description,
      url,
      image,
      show: show !== undefined ? show : 1,  // default to 1 (visible) if not provided
      publishDate: publishDate || Date.now(), // default to current date if not provided
    });

    await blog.save();
    res.status(201).json(blog);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Read all blogs
exports.getAllBlogs = async (req, res) => {
  try {
    const blogs = await Blog.find();

    if (blogs.length === 0) return res.status(404).json({ message: "No blogs found" });

    res.status(200).json(blogs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Read a single blog
exports.getBlogById = async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);

    if (!blog) return res.status(404).json({ message: "Blog not found" });

    res.status(200).json(blog);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update a blog
exports.updateBlog = async (req, res) => {
  console.log(req.body);
  const { title, description, url, image, show, publishDate } = req.body;

  try {
    // Validate ObjectId
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid Blog ID" });
    }

    // Find and update the blog
    const updatedBlog = await Blog.findByIdAndUpdate(
      id,
      {
        title,
        description,
        url,
        image,
        show: show !== undefined ? show : 1,  // default to 1 (visible) if not provided
        publishDate: publishDate || Date.now(),  // default to current date if not provided
      },
      { new: true, runValidators: true } // Ensures validation
    );

    // If blog is not found
    if (!updatedBlog) {
      return res.status(404).json({ error: "Blog not found" });
    }

    // Success response
    res.status(200).json(updatedBlog);
  } catch (error) {
    // Internal server error
    res.status(500).json({ error: error.message });
  }
};

// Delete a blog
exports.deleteBlog = async (req, res) => {
  try {
    // Validate ObjectId
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid Blog ID" });
    }

    // Find and delete the blog
    const blog = await Blog.findByIdAndDelete(id);

    // If blog is not found
    if (!blog) {
      return res.status(404).json({ error: "Blog not found" });
    }

    // Success response
    res.status(200).json({ message: "Blog deleted successfully" });
  } catch (error) {
    // Internal server error
    res.status(500).json({ error: error.message });
  }
};
