const axios = require('axios');
const cheerio = require('cheerio');

async function fetchScholarData(baseScholarUrl) {
    try {
        console.log(`Fetching from Google Scholar: ${baseScholarUrl}`);
        let allPublications = [];
        let profileInfo = {};
        
        let cstart = 0;
        const pagesize = 100;
        let hasMore = true;

        while (hasMore) {
            const pageUrl = `${baseScholarUrl}&cstart=${cstart}&pagesize=${pagesize}`;
            console.log(`Fetching page: cstart=${cstart}`);
            
            const { data } = await axios.get(pageUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Accept-Language': 'en-US,en;q=0.9',
                }
            });

            const $ = cheerio.load(data);
            
            // Only parse profile info on first page
            if (cstart === 0) {
                const name = $('#gsc_prf_in').text() || 'Unknown Researcher';
                const affiliation = $('.gsc_prf_il').first().text() || 'Unknown Affiliation';
                
                let total_citations = 0, h_index = 0, i10_index = 0;
                const citationStats = [];
                $('#gsc_rsb_st td.gsc_rsb_std').each((i, el) => { citationStats.push($(el).text()); });

                if (citationStats.length >= 6) {
                    total_citations = parseInt(citationStats[0], 10) || 0;
                    h_index = parseInt(citationStats[2], 10) || 0;
                    i10_index = parseInt(citationStats[4], 10) || 0;
                }
                
                profileInfo = { name, affiliation, scholar_url: baseScholarUrl, total_citations, h_index, i10_index };
            }

            const rows = $('.gsc_a_tr');
            if (rows.length === 0) {
                hasMore = false;
                break;
            }

            rows.each((i, el) => {
                const title = $(el).find('.gsc_a_t a').text();
                let pub_url = $(el).find('.gsc_a_t a').attr('href');
                if (pub_url && !pub_url.startsWith('http')) pub_url = `https://scholar.google.com${pub_url}`;
                const authors = $(el).find('.gsc_a_t > div.gs_gray').first().text();
                const venueAndYearInfo = $(el).find('.gsc_a_t > div.gs_gray').last().text();
                const citations = parseInt($(el).find('.gsc_a_c a').text(), 10) || 0;
                const year = parseInt($(el).find('.gsc_a_y .gsc_a_h').text(), 10) || null;

                allPublications.push({
                    title, authors, venue: venueAndYearInfo, year, citations, scholar_url: pub_url || baseScholarUrl
                });
            });

            if (rows.length < pagesize) hasMore = false;
            else cstart += pagesize;
            
            // tiny sleep to avoid rate limiting
            await new Promise(r => setTimeout(r, 1000));
        }

        // Set pub_number incrementally (1 is most recent Google Scholar item)
        allPublications.forEach((pub, idx) => { pub.pub_number = idx + 1; });
        profileInfo.total_publications = allPublications.length;

        return { profile: profileInfo, publications: allPublications };
    } catch (error) {
        console.error('Error fetching Scholar data:', error.message);
        throw error;
    }
}

module.exports = { fetchScholarData };
