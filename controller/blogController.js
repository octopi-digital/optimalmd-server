const Blog = require("../model/blogSchema");
const mongoose = require("mongoose");
const { addLog } = require("./logController");

// Create a blog
exports.createBlog = async (req, res) => {
  const { title, description, url, image, show, publishDate, userId } = req.body;

  try {
    if (!title || !description || !url || !image) {
      return res.status(400).json({ error: "Title, Description, URL, and Image are required" });
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
    // Log the creation
    addLog('Created Blog', userId, `Created blog with title: ${title}`);
    res.status(201).json(blog);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Read all blogs
exports.getAllBlogs = async (req, res) => {
  try {
    const { show, page = 1, limit = 10 } = req.query; // Default page = 1, limit = 10

    // Convert page and limit to integers
    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);

    if (pageNumber <= 0 || limitNumber <= 0) {
      return res.status(400).json({ error: "Page and limit must be positive integers." });
    }

    // Initialize variables for blogs and total count
    let blogs;
    let totalBlogs;

    if (show !== undefined) {
      // Validate `show` input
      if (![0, 1].includes(parseInt(show, 10))) {
        return res.status(400).json({ error: "Invalid value for 'show'. It must be 0 or 1." });
      }

      const showFilter = parseInt(show, 10);

      // Fetch blogs filtered by the `show` value with pagination and sorting
      blogs = await Blog.find({ show: showFilter })
        .sort({ publishDate: -1 }) // Sort by most recent
        .skip((pageNumber - 1) * limitNumber)
        .limit(limitNumber);

      // Count the total blogs for the specified `show` value
      totalBlogs = await Blog.countDocuments({ show: showFilter });
    } else {
      // Fetch all blogs with pagination and sorting
      blogs = await Blog.find()
        .sort({ publishDate: -1 }) // Sort by most recent
        .skip((pageNumber - 1) * limitNumber)
        .limit(limitNumber);

      // Count the total blogs
      totalBlogs = await Blog.countDocuments();
    }

    // Calculate total pages
    const totalPages = Math.ceil(totalBlogs / limitNumber);

    // Send response with blogs and pagination details
    res.status(200).json({
      blogs,
      pagination: {
        currentPage: pageNumber,
        totalPages,
        totalBlogs,
        limit: limitNumber,
      },
    });
  } catch (error) {
    console.error("Error fetching blogs:", error);
    res.status(500).json({ error: "Failed to fetch blogs." });
  }
};


// Fetch blogs that are visible (show: 1)
exports.getVisibleBlogs = async (req, res) => {
  try {
    // Find blogs where 'show' is 1 (visible)
    const blogs = await Blog.find({ show: 1 });

    // If no blogs are found, return a 404 error
    if (!blogs || blogs.length === 0) {
      return res.status(404).json({ message: "No visible blogs found" });
    }

    // Return the visible blogs
    return res.status(200).json(blogs);
  } catch (error) {
    console.error("Error fetching visible blogs:", error);
    return res.status(500).json({ error: "Server error" });
  }
};


// Read a single blog
exports.getBlogById = async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);

    if (!blog) return res.status(404).json({ error: "Blog not found" });

    res.status(200).json(blog);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update a blog
exports.updateBlog = async (req, res) => {
  const { title, description, url, image, show, publishDate, userId } = req.body;

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
        publishDate: publishDate,  // default to current date if not provided
      },
      { new: true, runValidators: true } // Ensures validation
    );

    // If blog is not found
    if (!updatedBlog) {
      return res.status(404).json({ error: "Blog not found" });
    }

    addLog('Update Blog', userId, `Updated blog with title: ${updatedBlog.title}`);
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
    const { id } = req.params;
    const { userId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid Blog ID" });
    }

    const blog = await Blog.findById(id);

    if (!blog) {
      return res.status(404).json({ error: "Blog not found" });
    }

    await Blog.findByIdAndDelete(id);

    // Log the deletion
    addLog('Delete Blog', userId, `Deleted blog with title: ${blog.title}`);

    res.status(200).json({ message: "Blog deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

