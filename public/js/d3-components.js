

var d3Components = function(){};

d3Components.prototype._build_chart = function(widget){

    var c = widget.config;

    c.full_width = 500;
    c.full_height = 500;

    c.margin = {};
    c.margin.left = 50;
    c.margin.right = 50;
    c.margin.top = 50;
    c.margin.bottom = 50;



    c.width =  c.full_width - c.margin.left  - c.margin.right;
    c.height = c.full_height - c.margin.bottom - c.margin.top;

    var svg = d3.select(widget.container)
        .append("div")
        .classed("svg-container", true)
        .append("svg")
        .attr("class", "widget")
        .attr("id", "widget" + widget.widgetId)
        .attr("preserveAspectRatio", "xMinYMin meet")
        .attr("viewBox", "0 0 " + c.full_width + " " + c.full_height )
        .classed("svg-content-responsive", true);


    var chart = svg
        .append('g')
        .attr("transform", "translate(" + c.margin.left + "," + c.margin.top + ")");

    return chart


}


d3Components.prototype._map = function(widget, configuration){

    var that = {};

    that.config = {};
    //
    var svg = undefined;
    var polygon_layer = undefined;
    var poi_layer = undefined;
    //var topojson_data = undefined;
    var projection = undefined;
    var path = undefined;
    var polygon = undefined;
    var poi = undefined;
    var poi_back = undefined;
    var poiMax = undefined;
    //
    //function feature_click(d){
    //    controller._area_change(d.properties.id)
    //
    //}


    function configure(widget, configuration) {

        var self = this;
        that.config = configuration;


        //var config = controller.config;
        //var state = controller.state;

        //topojson_data = controller.data_obj.topojson_obj[state.areaType];
        //
        //

        projection = d3.geo.albers()
            .center([2.05, 51.45])
            .rotate([4.4, 0])
            .parallels([50, 60])
            .scale(25000)
            .translate([-100,20]);
            //.scale(that.config.compWidth * 45)
            //.translate([that.config.compWidth / 4, that.config.compHeight / 4]);

        path = d3.geo.path()
            .projection(projection);

        //features = topojson.feature(topojson_data, topojson_data.objects.collection).features;



        polygon = widget.polygon;
        //console.log(features)

        poi = widget.poi;
        //console.log(poi)

        //console.log(projection(poi[0].geometry.coordinates))



    }
    that.configure = configure;

    function isRendered() {
        return (svg !== undefined);
    }
    that.isRendered = isRendered;

    function render() {

        //var config = controller.config;
        //var state = controller.state;

        //var current_area = state.current_area;

        svg = widget.chart.append("g");
            //.attr("transform", "translate(" + that.config.x + "," + that.config.y + ")");

        polygon_layer = svg.selectAll("path")
            .data(polygon)
            .enter()
            .append("path")
            .attr("class", "polygon")
            .attr("id", function(d){ return "polygon" + d.properties[that.config.id] + widget.widgetId})
            .attr("d", path)
            .style({
                "stroke":"black",
                "stroke-width":1,
                "fill":"white"
            })
            .on("mouseover", function(d) {
                div.transition()
                    .duration(200)
                    .style("opacity", .95);
                div	.html(d.properties.LAD14NM + " District<br/>&pound" + Math.round(d.properties.val).toLocaleString())
                    .style("left", (d3.event.pageX + 28) + "px")
                    .style("top", (d3.event.pageY - 28) + "px");
            })
            .on("mouseout", function(d) {
                div.transition()
                    .duration(500)
                    .style("opacity", 0);
            });
            //.style(that.config.style)
            //.on("click", feature_click);









        //poi_back = svg.selectAll("circle_back")
        //    .data(poi)
        //    .enter()
        //    .append("circle")
        //    .attr("cx", function (d) { return projection(d.geometry.coordinates)[0]; })
        //    .attr("cy", function (d) { return projection(d.geometry.coordinates)[1]; })
        //    .attr("r", "10px")
        //    .attr("fill", "white")
        //    .attr("stroke", "black")
        //    .attr("stroke-width", "2px")

        // Define the div for the tooltip
        var div = d3.select("body").append("div")
            .attr("class", "tooltip")
            .style("opacity", 0);

        poi_layer = svg.selectAll("circle_front")
            .data(poi)
            .enter()
            .append("circle")
            .attr(that.config.poi_class)
            .attr("cx", function (d) { return projection(d.geometry.coordinates)[0]; })
            .attr("cy", function (d) { return projection(d.geometry.coordinates)[1]; })
            .attr("r", "4px")
            .attr("fill", "black")
            .attr("stroke", "black")
            .attr("stroke-width", "2px")
            .on("mouseover", function(d) {
                div.transition()
                    .duration(200)
                    .style("opacity", .9);

                var html_string;
                if(d.properties.val == 0){
                    html_string = d.properties.id + " HWRC<br/>-closed-</br>click to open"
                } else {
                    html_string = d.properties.id + " HWRC<br/>&pound" + Math.round(d.properties.val).toLocaleString()
                }

                div	.html(html_string)
                    .style("left", (d3.event.pageX) + 28 + "px")
                    .style("top", (d3.event.pageY - 28) + "px");


            })
            .on("mouseout", function(d) {
                div.transition()
                    .duration(500)
                    .style("opacity", 0);
            })
            .on("click", function(d){
                ee.emitEvent("update_map_nid", [d.properties.bit_index])
            })
        ;




    }
    that.render = render;



    function update(polygon, poi, poiMax, first_update) {

        var rscale = d3.scale.linear()
            .domain([0,poiMax])
            .range([4,10])

        polygon_layer
            .data(polygon)
            .transition()
            .duration(1000)
            .style(that.config.polygon_style)
        //
        //d3.select("#feature" + state.current_area + widget.widgetId).moveToFront();





        poi_layer
            .data(poi)
            //.attr(that.config.poi_class)
            .attr("id", function(d) {
                return "#poi_" + widget.widgetId + "_" + d.properties.id})
            .transition()
            .duration(1000)
            .style(that.config.poi_style)
            .attr('r', function(d){
                return rscale(d.properties.val);
            })

        //poi.sort(function(a,b){
        //    if (a.properties.val < b.properties.val)
        //        return 1;
        //    else if (a.properties.val > b.properties.val)
        //        return -1;
        //    else
        //        return 0;
        //})

        for(var i = 0; i < poi.length; i++){
            d3.select("#poi_" + widget.widgetId + "_" + poi[i].properties.id).moveToFront();
        }




    }
    that.update = update;

    //ee.addListener("update", update)

    configure(widget, configuration);

    return that;

};




//---d3 functions--------------

d3.selection.prototype.moveToBack = function() {
    return this.each(function() {
        var firstChild = this.parentNode.firstChild;
        if (firstChild) {

            this.parentNode.insertBefore(this, firstChild);
        }
    });
};

d3.selection.prototype.moveToFront = function() {
    return this.each(function(){
        this.parentNode.appendChild(this);
    });
};