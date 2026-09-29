const supabase = require('../configure/supabase');

// Helper headers for GitHub API to prevent rate limits
const getGitHubHeaders = () => ({
  headers: {
    Authorization: process.env.GITHUB_TOKEN ? `Bearer ${process.env.GITHUB_TOKEN}` : ''
  }
});

// POST /api/users - Fetch GitHub user, calculate score, and store/update in Supabase
exports.addOrUpdateUser = async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) {
      return res.status(400).json({ error: 'GitHub username is required' });
    }

    // 1. Fetch user profile from GitHub API
    const userRes = await fetch(`https://api.github.com/users/${username}`, getGitHubHeaders());
    if (!userRes.ok) {
      return res.status(404).json({ error: 'GitHub user not found' });
    }
    const userData = await userRes.json();

    // 2. Fetch user repositories to calculate total stars
    const reposRes = await fetch(`https://api.github.com/users/${username}/repos?per_page=100`, getGitHubHeaders());
    const reposData = await reposRes.json();

    let totalStars = 0;
    if (Array.isArray(reposData)) {
      totalStars = reposData.reduce((acc, repo) => acc + (repo.stargazers_count || 0), 0);
    }

    // 3. Calculate a ranking score (Example formula: Stars * 2 + Followers + Public Repos)
    const publicRepos = userData.public_repos || 0;
    const followers = userData.followers || 0;
    const score = (totalStars * 2) + followers + publicRepos;

    const userPayload = {
      username: userData.login,
      name: userData.name || userData.login,
      public_repos: publicRepos,
      followers: followers,
      total_stars: totalStars,
      score: score
    };

    // 4. Upsert (Insert or Update) into Supabase table
    const { data, error } = await supabase
      .from('github_users')
      .upsert(userPayload, { onConflict: 'username' })
      .select();

    if (error) throw error;

    res.status(200).json({
      message: 'User processed and ranked successfully!',
      data: data[0]
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// GET /api/users - Retrieve all stored users sorted by rank (score desc)
exports.getLeaderboard = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('github_users')
      .select('*')
      .order('score', { ascending: false });

    if (error) throw error;

    res.status(200).json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
