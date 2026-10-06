import http from 'http';

const testApi = () => {
    const url = 'http://localhost:5000/api/products/gst/effective?categoryId=6a4e130d5327100bd73d9436&price=450&taxIncluded=false&productId=6a6848868c857498b1daa597';
    console.log("Sending GET request to:", url);
    
    http.get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => {
            data += chunk;
        });
        res.on('end', () => {
            console.log("STATUS CODE:", res.statusCode);
            console.log("HEADERS:", res.headers);
            console.log("RESPONSE BODY:");
            console.log(data);
        });
    }).on('error', (err) => {
        console.error("HTTP Request Error:", err.message);
    });
};

testApi();
