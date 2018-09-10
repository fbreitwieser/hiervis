# :cactus: d3-hiervis - Hierarchical visualization with D3

"Many datasets are intrinsically hierarchical. Consider geographic entities, such as census blocks, census tracts, counties and states; the command structure of businesses and governments; file systems and software packages. And even non-hierarchical data may be arranged empirically into a hierarchy, as with k-means clustering or phylogenetic trees." [d3-hierarchy README](https://github.com/d3/d3-hierarchy)

This module is based on [d3 hierarchy](https://github.com/d3/d3-hierarchy) and makes it easier to use and switch between several popular techniques for visualizing hierarchical data, including sunburst, sankey and partition. 

![ezgif-5-4e1ea53a07](https://user-images.githubusercontent.com/516060/45301339-c2e00200-b4de-11e8-9a54-3cac7f052335.gif)

Demo at https://bl.ocks.org/fbreitwieser/31e4be931541c74732dd6807ccb98daf

## Installing

If you use NPM, `npm install d3-hiervis`. Otherwise, download the [latest release](https://github.com/fbreitwieser/d3-hiervis/releases/latest).

## API Reference

API DOCUMENTATION HERE. Use bold for symbols (such as constructor and method names) and italics for instances. See the other D3 modules for examples.

## Options
Data import:
 - `pathField`: e.g. `"path"`
 - `valueField`: e.g. `"size"`
 - `stat`: e.g. `"sum"`
 - `pathSep`: e.g. `"/"`

### Partition and Icicle (vertical partition)
Based on Mike Bostock's [Zoomable Icicle](https://bl.ocks.org/mbostock/1005873)

### Sunburst
Based on Vasco Asturiano's [Zoomable Sunburst with Labels](https://bl.ocks.org/vasturiano/12da9071095fbd4df434e60d52d2d58d).

### Sankey
based on timelyportfolio's interactive [parttree](http://www.jsinr.me/2017/11/13/visualizing-trees--partition---sankey/).


<a href="#hiervis" name="hiervis">#</a> <b>hiervis</b>()

