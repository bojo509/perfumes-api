import express from 'express'

const app = express()
const port = process.env.PORT || 3000
app.get('/', (req, res) => {
    res.json([
        {"link": "https://parfium.bg/mont-blanc-legend-blue-parfyumna-voda-za-mazhe-bez-opakovka-edp", "title": "montblanc legend blue without box"},
        {"link": "https://parfium.bg/mont-blanc-legend-blue-parfyumna-voda-za-mazhe-edp", "title": "montblanc legend blue"}
    ])
})

app.listen(port, () => {
    console.log(`Server is running on localhost:${port}`)
})
