(function () {	
	//subscribe
	function subscribe_to_server () {
		var email = $("#subscribe-input").val();
		$.ajax({
			url: "https://ec2-13-59-71-153.us-east-2.compute.amazonaws.com:80/subscribe",
			type: 'post',
			dataType: 'text',
			data: email
		}).done(function(data) {
			$("div.subscribe-block-feedback").text("Successfully subscribed!");
		});
	}
	
	function unsubscribe_to_server () {
		var email = $("#subscribe-input").val();
		$.ajax({
			url: "https://ec2-13-59-71-153.us-east-2.compute.amazonaws.com:80/unsubscribe",
			type: 'post',
			dataType: 'text',
			data: email
		}).done(function(data) {
			$("div.subscribe-block-feedback").text("Successfully unsubscribed!");
		});
	}
	
	$("#subscribe-block-button-sub").click(function(){
		subscribe_to_server ();
	});
	
	$("#subscribe-block-button-unsub").click(function(){
		unsubscribe_to_server ();
	});
	
	$(document).ready(function(){
		$.ajax({
			url: "https://ec2-13-59-71-153.us-east-2.compute.amazonaws.com:80/subscribe_status",
			type: 'get',
			dataType: 'text'
		}).done(function(data) {
			$("div.subscribe-block-status p").text(data);
		});
	});
})(jQuery)