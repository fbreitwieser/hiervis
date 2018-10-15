# :cactus: d3-hiervis - Hierarchical visualizations for R/Shiny

"Many datasets are intrinsically hierarchical. Consider geographic entities, such as census blocks, census tracts, counties and states; the command structure of businesses and governments; file systems and software packages. And even non-hierarchical data may be arranged empirically into a hierarchy, as with k-means clustering or phylogenetic trees." [d3-hierarchy README](https://github.com/d3/d3-hierarchy)

The standalone JS/D3 part of the library is available at https://github.com/fbreitwieser/d3-hiervis. 

![ezgif-5-4e1ea53a07](https://user-images.githubusercontent.com/516060/45301339-c2e00200-b4de-11e8-9a54-3cac7f052335.gif)

## Usage
```
# devtools::install_github("fbreitwieser/hiervis)
library(hiervis)
hiervis("sankey", d3_modules)
hiervis("sunburst", d3_modules)
hiervis("partition", d3_modules)
hiervis("icicle", d3_modules)
```

