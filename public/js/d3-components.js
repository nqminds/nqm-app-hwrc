

var d3Components = function(){};

d3Components.prototype._build_chart = function(widget){

    var c = widget.config;

    c.full_width = 1400;
    c.full_height = 400;

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
            .scale(20000)
            .translate([0,50]);
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

        svg = widget.chart.append("g")
            //.attr("transform", "translate(" + that.config.x + "," + that.config.y + ")");

        polygon_layer = svg.selectAll("path")
            .data(polygon)
            .enter()
            .append("path")
            .attr("class", "feature clickable")
            .attr("id", function(d){ return "feature" + d.properties[that.config.id] + widget.widgetId})
            .attr("d", path)
            .style({
                "stroke":"black",
                "stroke-width":1,
                "fill":"white"
            })
            //.style(that.config.style)
            //.on("click", feature_click);

        //d3.select("#feature" + state.current_area + widget.widgetId).moveToFront();


        poi_layer = svg.selectAll("circle")
            .data(poi)
            .enter()
            .append("circle")
            .attr("cx", function (d) { return projection(d.geometry.coordinates)[0]; })
            .attr("cy", function (d) { return projection(d.geometry.coordinates)[1]; })
            .attr("r", "6px")
            .attr("fill", "white")
            .attr("stroke", "black")
            .attr("stroke-width", "2px")



    }
    that.render = render;

    function update(polygon_data, poi_data) {

        polygon_layer
            .data(polygon_data)
            .transition()
            .duration(1000)
            .style(that.config.polygon_style)
        //
        //d3.select("#feature" + state.current_area + widget.widgetId).moveToFront();

        poi_layer
            .data(poi_data)
            .transition()
            .duration(1000)
            .style(that.config.poi_style)

    }
    that.update = update;

    //ee.addListener("update", update)

    configure(widget, configuration);

    return that;

};


