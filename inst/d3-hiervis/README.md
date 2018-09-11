# :cactus: d3-hiervis - Hierarchical visualization with D3

"Many datasets are intrinsically hierarchical. Consider geographic entities, such as census blocks, census tracts, counties and states; the command structure of businesses and governments; file systems and software packages. And even non-hierarchical data may be arranged empirically into a hierarchy, as with k-means clustering or phylogenetic trees." [d3-hierarchy README](https://github.com/d3/d3-hierarchy)

This module is based on [d3 hierarchy](https://github.com/d3/d3-hierarchy) and makes it easier to use and switch between several popular techniques for visualizing hierarchical data, including sunburst, sankey and partition. 

![ezgif-5-4e1ea53a07](https://user-images.githubusercontent.com/516060/45301339-c2e00200-b4de-11e8-9a54-3cac7f052335.gif)

Demo at https://bl.ocks.org/fbreitwieser/31e4be931541c74732dd6807ccb98daf

## Usage
```html
<script src="https://d3js.org/d3.v5.min.js"></script>
<script src="https://rawgit.com/fbreitwieser/d3-hiervis/master/src/hiervis.js"></script>
<script src="https://rawgit.com/fbreitwieser/d3-hiervis/master/src/TreeColors.js"></script>
<svg width="100%" height="400"> </svg>
<script>
d3.csv("https://raw.githubusercontent.com/fbreitwieser/d3-hiervis/master/data/d3.csv").then(function(data) {
    chart = hiervis(d3.select("svg"), data, {nameField: "path", pathSep: "/", valueField: "size", stat: "sum"});
    chart.draw("sankey")
  });
</script>
```

## Installing

If you use NPM, `npm install d3-hiervis`. Otherwise, download the [latest release](https://github.com/fbreitwieser/d3-hiervis/releases/latest).

## API Reference

API DOCUMENTATION HERE. Use bold for symbols (such as constructor and method names) and italics for instances. See the other D3 modules for examples.

## Options
Data import:
  - default: data is already in hierarchical form, i.e. data is an object representing the root node
  - if `pathSep` is specified: data is tabular, with `nameField` defining a path, delimited by `pathField`
  - else if `parentFiled` is specified: data is tabular, with `parentField` defining the parent of `nameField`
  
### Partition and Icicle (vertical partition)
Based on Mike Bostock's [Zoomable Icicle](https://bl.ocks.org/mbostock/1005873)

### Sunburst
Based on Vasco Asturiano's [Zoomable Sunburst with Labels](https://bl.ocks.org/vasturiano/12da9071095fbd4df434e60d52d2d58d).

### Sankey
based on timelyportfolio's interactive [parttree](http://www.jsinr.me/2017/11/13/visualizing-trees--partition---sankey/).


<a href="#hiervis" name="hiervis">#</a> <b>hiervis</b>()

