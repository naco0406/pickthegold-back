const express = require('express');
const axios = require('axios');
const router = express.Router();

router.get('/callback', async (req, res) => {
    const code = req.query.code;
    console.log(code)
    try {
        const response = await axios.post('https://github.com/login/oauth/access_token', {
            client_id: process.env.GITHUB_CLIENT_ID,
            client_secret: process.env.GITHUB_CLIENT_SECRET,
            code: code,
        }, { headers: { accept: 'application/json' } });

        const accessToken = response.data.access_token;

        const userResponse = await axios.get('https://api.github.com/user', {
            headers: { Authorization: `token ${accessToken}` }
        });

        const userData = userResponse.data;
        console.log(userData)

        // 사용자 세션에 정보 저장
        req.session.user = { id: userData.id, username: userData.login };
        // res.redirect('/')
        res.redirect(`http://localhost:3000/?username=${userData.login}&id=${userData.id}`);
    } catch (error) {
        console.error('Error during GitHub OAuth process', error);
        res.redirect('/error');
    }
});

module.exports = router;
