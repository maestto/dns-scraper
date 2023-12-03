const puppeteer = require('puppeteer-extra')
const StealthPlugin = require('puppeteer-extra-plugin-stealth')
const csvWriter = require('csv-writer')

puppeteer.use(StealthPlugin())

puppeteer.launch({ headless: true }).then(async browser => {
    const page = await browser.newPage()

    await page.setRequestInterception(true);
    page.on('request', (request) => {
        const requestUrl = request.url()
        const requestType = request.resourceType()

        if (
            requestType === 'image' ||
            requestType === 'stylesheet' ||
            requestType === 'font' ||
            requestType === 'media' ||
            requestType === 'script' && !requestUrl.includes('dns-shop.ru')
        ) {
            request.abort()
        } else {
            request.continue()
        }
    })

    let pageEmpty = false
    let pageNumber = 1

    const allPagesData = []

    while(!pageEmpty) {
        await page.goto(`https://www.dns-shop.ru/catalog/17a8d26216404e77/vstraivaemye-xolodilniki/?p=${pageNumber}`).then(async () => {
            await page.waitForSelector('.products-list').then(async () => {
                await page.waitForSelector('.catalog-product').then(async () => {
                    // await page.screenshot({ path: `page_{pageNumber}.png`, fullPage: true })

                    const pageData = await page.evaluate(() => {
                        const productNodes = document.querySelectorAll('.catalog-product');

                        const productData = []
                        productNodes.forEach((node) => {
                            const nameElement = node.querySelector('.catalog-product__name')
                            const priceElement = node.querySelector('.product-buy__price')

                            if (nameElement && priceElement) {
                                const nameText = nameElement.textContent.trim()
                                const priceText = priceElement.textContent.trim()

                                const extractedPrice = priceText.match(/\d[\s\d]*/)[0].replace(/\s/g, '')

                                productData.push({
                                    nameText,
                                    extractedPrice
                                })
                            }
                        })

                        return productData
                    })

                    allPagesData.push(...pageData)
                    if(pageData.length !== 0) pageNumber++
                }).catch(async () => {
                    pageEmpty = true
                })
            }).catch(async (error) => {
                console.log(error)
                await page.screenshot({ path: 'errorScreenshot.png', fullPage: true })
            })
        })
    }

    const csvObject = csvWriter.createObjectCsvWriter({
        path: `output.csv`,
        header: [
            { id: 'nameText', title: 'Name' },
            { id: 'extractedPrice', title: 'Price' }
        ]
    })

    await csvObject.writeRecords(allPagesData)

    await browser.close()
})