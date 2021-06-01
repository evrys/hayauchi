/**
 * @type {import('@vue/cli-service').ProjectOptions}
 */
module.exports = {
  chainWebpack: config => {
    config.module
      .rule('tsv')
      .test(/\.tsv$/)
      .use('csv-loader')
        .loader('csv-loader')
        .tap(options => {
          return { delimiter: "\t" }
        })
        .end()
  }
}